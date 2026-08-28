## gradcam.py
## app/services/inference/gradcam.py
"""
gradcam.py
==========
Grad-CAM for XceptionMultiOutput (timm backbone).

Architecture facts (from training notebook + timm source):
  - backbone = timm.create_model('xception', num_classes=0)
  - Spatial flow: conv1 → conv2 → block1..block12 → conv3 → conv4 → act3 → GAP
  - block12 = last middle-flow SeparableConv block (spatial: 10×10, 728ch)
  - conv4   = exit-flow pointwise projection (10×10, 2048ch)

Why block12 and not conv4:
  - conv4 is a 1×1 pointwise conv — spatially rich but gradient signal
    is weak because it just projects channels with no spatial mixing.
  - block12 is the last depthwise-separable block that still performs
    spatial convolution. Its gradients carry strong positional signal,
    giving a meaningful Grad-CAM heatmap.

Why we try all 5 feature heads:
  - The model has NO tirads output head. We must pick a feature head.
  - Different heads specialise on different visual patterns. The head
    with the highest-variance heatmap is the most spatially discriminative
    for this particular image, so we pick that one automatically.
"""

import numpy as np
import torch
import torch.nn.functional as F
from typing import Tuple, Optional, Dict, List


# All valid output keys from XceptionMultiOutput.forward()
ALL_FEATURE_HEADS: List[str] = [
    "composition", "echogenicity", "shape", "margin", "echogenic_foci"
]


class GradCAM:
    """
    Grad-CAM for a single (layer, output_head, class_idx) combination.

    Args:
        model:        XceptionMultiOutput instance (eval mode).
        target_layer: nn.Module to hook — use model.backbone.block12.
    """

    def __init__(self, model: torch.nn.Module, target_layer: torch.nn.Module):
        self.model = model
        self.target_layer = target_layer
        self._activations: Optional[torch.Tensor] = None
        self._gradients: Optional[torch.Tensor] = None

        self._fwd_hook = target_layer.register_forward_hook(self._save_activations)
        self._bwd_hook = target_layer.register_full_backward_hook(self._save_gradients)

    def _save_activations(self, module, input, output):
        self._activations = output.detach()

    def _save_gradients(self, module, grad_input, grad_output):
        self._gradients = grad_output[0].detach()

    def compute(
        self,
        input_tensor: torch.Tensor,
        output_key: str,
        target_class_idx: int,
    ) -> Tuple[np.ndarray, np.ndarray]:
        """
        Compute Grad-CAM for a specific (output_key, class_idx) pair.

        Uses torch.enable_grad() explicitly — required because the caller
        runs under torch.no_grad(), which would zero out all gradients.

        Returns:
            heatmap_small: (H, W) float32 in [0, 1]  — raw feature map res
            heatmap_large: (299, 299) float32 in [0, 1] — upsampled
        """
        if input_tensor.dim() == 3:
            input_tensor = input_tensor.unsqueeze(0)

        device = next(self.model.parameters()).device
        input_tensor = input_tensor.to(device)

        self.model.zero_grad()
        self._activations = None
        self._gradients = None

        with torch.enable_grad():
            inp = input_tensor.detach().requires_grad_(True)
            outputs = self.model(inp)

            if output_key not in outputs:
                raise KeyError(
                    f"'{output_key}' not in model outputs. "
                    f"Available: {list(outputs.keys())}"
                )

            logits = outputs[output_key]
            n_classes = logits.shape[1]
            idx = min(target_class_idx, n_classes - 1)
            score = logits[0, idx]
            score.backward(retain_graph=False)

        if self._gradients is None or self._activations is None:
            raise RuntimeError(
                "Grad-CAM hooks did not fire. "
                "Ensure target_layer is in the active forward path."
            )

        # Grad-CAM: α_k = GAP(grads),  L = ReLU(Σ α_k · A_k)
        weights = self._gradients.mean(dim=(2, 3), keepdim=True)
        cam = F.relu((weights * self._activations).sum(dim=1, keepdim=True))
        cam = cam.squeeze()  # (H, W)

        cam_min, cam_max = cam.min(), cam.max()
        span = (cam_max - cam_min).abs()

        if span < 1e-8:
            return np.zeros_like(cam.cpu().numpy(), dtype=np.float32), \
                   np.zeros((299, 299), dtype=np.float32)

        cam_norm = (cam - cam_min) / span
        heatmap_small = cam_norm.cpu().numpy().astype(np.float32)

        heatmap_large = F.interpolate(
            cam_norm.unsqueeze(0).unsqueeze(0),
            size=(299, 299),
            mode="bilinear",
            align_corners=False,
        ).squeeze().cpu().numpy().astype(np.float32)

        return heatmap_small, heatmap_large

    def remove_hooks(self):
        self._fwd_hook.remove()
        self._bwd_hook.remove()

    def __del__(self):
        try:
            self.remove_hooks()
        except Exception:
            pass


def compute_best_gradcam(
    model: torch.nn.Module,
    target_layer: torch.nn.Module,
    input_tensor: torch.Tensor,
    feature_results: Dict,
) -> Tuple[np.ndarray, np.ndarray, str, int]:
    """
    Try all 5 feature heads and return the heatmap with the highest variance.

    A high-variance heatmap means the model has strong spatial opinions
    about this prediction — it's the most clinically informative one to show.

    Args:
        model:          XceptionMultiOutput instance.
        target_layer:   Grad-CAM target layer (backbone.block12).
        input_tensor:   ROI tensor (1, 3, 299, 299).
        feature_results: Feature classifier output dict (for class indices).

    Returns:
        best_heatmap_small: (H, W) float32 in [0, 1]
        best_heatmap_large: (299, 299) float32 in [0, 1]
        best_head:          Name of the winning feature head
        best_class_idx:     Class index used for the winning head
    """
    best_variance = -1.0
    best_small = np.zeros((10, 10), dtype=np.float32)
    best_large = np.zeros((299, 299), dtype=np.float32)
    best_head = ALL_FEATURE_HEADS[0]
    best_class_idx = 0

    for head in ALL_FEATURE_HEADS:
        # Get the predicted class index for this head
        class_idx = feature_results.get(head, {}).get("index", 0)

        gcam = GradCAM(model, target_layer)
        try:
            small, large = gcam.compute(input_tensor, output_key=head, target_class_idx=class_idx)
            variance = float(np.var(small))
            print(f"  Grad-CAM [{head} cls={class_idx}] → variance={variance:.6f}")

            if variance > best_variance:
                best_variance = variance
                best_small = small
                best_large = large
                best_head = head
                best_class_idx = class_idx
        except Exception as e:
            print(f"  Grad-CAM [{head}] failed: {e}")
        finally:
            gcam.remove_hooks()

    print(f"✅ Best Grad-CAM head: '{best_head}' cls={best_class_idx} variance={best_variance:.6f}")
    return best_small, best_large, best_head, best_class_idx


def get_xception_target_layer(model: torch.nn.Module) -> torch.nn.Module:
    """
    Return backbone.block12 — the last middle-flow depthwise-separable block
    in timm's Xception. This is the optimal Grad-CAM target because:
      - It is the deepest layer with full spatial convolution (10×10 output)
      - Its gradients carry strong class-discriminative spatial signal
      - conv4 (exit flow) is a 1×1 projection and gives weaker spatial gradients

    Falls back progressively if block12 is not present.
    """
    backbone = getattr(model, "backbone", model)

    # Priority 1: block12 — last middle-flow block (best spatial gradients)
    for attr in ["block12", "block11", "block10", "block9"]:
        layer = getattr(backbone, attr, None)
        if layer is not None:
            print(f"✅ Grad-CAM target layer: backbone.{attr}")
            return layer

    # Priority 2: exit-flow conv (still spatial, just weaker)
    for attr in ["conv4", "act3", "conv3"]:
        layer = getattr(backbone, attr, None)
        if layer is not None:
            print(f"✅ Grad-CAM target layer: backbone.{attr} (exit-flow fallback)")
            return layer

    # Priority 3: last Conv2d in backbone
    last_conv = None
    for name, module in backbone.named_modules():
        if isinstance(module, torch.nn.Conv2d):
            last_conv = (name, module)
    if last_conv:
        print(f"✅ Grad-CAM target layer: backbone.{last_conv[0]} (Conv2d fallback)")
        return last_conv[1]

    raise AttributeError(
        "Could not resolve any Grad-CAM target layer. "
        "Pass target_layer explicitly to GradCAM(model, target_layer=...)."
    )
# xception_model.py

import torch
import torch.nn as nn
import timm

class XceptionMultiOutput(nn.Module):
    """
    Multi-output Xception model that predicts all 5 TI-RADS features.
    Updated to match V2 Training Pipeline architecture.
    """
    
    def __init__(self, pretrained=False, dropout_rate=0.3):
        super(XceptionMultiOutput, self).__init__()
        
        # Load Xception backbone
        self.backbone = timm.create_model('xception', pretrained=pretrained, num_classes=0)
        num_features = self.backbone.num_features  # 2048 for Xception
        
        # Shared feature extraction with regularization
        self.shared_fc = nn.Sequential(
            nn.Dropout(dropout_rate),
            nn.Linear(num_features, 1024),
            nn.BatchNorm1d(1024),
            nn.ReLU(),
            nn.Dropout(dropout_rate / 2),
            nn.Linear(1024, 512),
            nn.BatchNorm1d(512),
            nn.ReLU()
        )
        
        # Feature prediction heads - output number of point classes
        # Composition: 5 classes
        self.composition_head = nn.Sequential(
            nn.Dropout(dropout_rate / 2),
            nn.Linear(512, 5)
        )
        
        # Echogenicity: 5 classes
        self.echogenicity_head = nn.Sequential(
            nn.Dropout(dropout_rate / 2),
            nn.Linear(512, 5)
        )
        
        # Shape: 2 classes
        self.shape_head = nn.Sequential(
            nn.Dropout(dropout_rate / 2),
            nn.Linear(512, 2)
        )
        
        # Margin: 5 classes
        self.margin_head = nn.Sequential(
            nn.Dropout(dropout_rate / 2),
            nn.Linear(512, 5)
        )
        
        # Echogenic Foci: 5 classes
        self.echogenic_foci_head = nn.Sequential(
            nn.Dropout(dropout_rate / 2),
            nn.Linear(512, 5)
        )

    def forward(self, x):
        """
        Forward pass.
        
        Returns:
            Dict with 5 feature predictions
        """
        # Extract features from backbone
        features = self.backbone(x)
        
        # Shared feature processing
        shared = self.shared_fc(features)
        
        # Predict each feature
        return {
            'composition': self.composition_head(shared),
            'echogenicity': self.echogenicity_head(shared),
            'shape': self.shape_head(shared),
            'margin': self.margin_head(shared),
            'echogenic_foci': self.echogenic_foci_head(shared)
        }

# Feature definitions and point mappings (Synchronized with ML team)
FEATURE_DEFINITIONS = {
    'composition': {
        'classes': ['cystic', 'spongiform', 'mixed_cystic_solid', 'solid', 'partially_cystic'],
        'points': [0, 0, 1, 2, 1],
        'descriptions': [
            'Cystic or almost completely cystic',
            'Spongiform (>50% cystic)',
            'Mixed cystic and solid',
            'Solid or almost completely solid',
            'Partially cystic with solid components'
        ]
    },
    'echogenicity': {
        'classes': ['anechoic', 'hyperechoic', 'isoechoic', 'hypoechoic', 'very_hypoechoic'],
        'points': [0, 1, 1, 2, 3],
        'descriptions': [
            'Anechoic (cystic, no echoes)',
            'Hyperechoic or isoechoic (brighter than or same as thyroid)',
            'Isoechoic (same as thyroid)',
            'Hypoechoic (darker than thyroid)',
            'Very hypoechoic (darker than strap muscles)'
        ]
    },
    'shape': {
        'classes': ['wider_than_tall', 'taller_than_wide'],
        'points': [0, 3],
        'descriptions': [
            'Wider than tall (horizontal orientation)',
            'Taller than wide (vertical orientation, suspicious)'
        ]
    },
    'margin': {
        'classes': ['smooth', 'ill_defined', 'lobulated', 'irregular', 'extrathyroidal_extension'],
        'points': [0, 0, 2, 2, 3],
        'descriptions': [
            'Smooth margins',
            'Ill-defined margins',
            'Lobulated or irregular margins',
            'Irregular margins',
            'Extra-thyroidal extension (very suspicious)'
        ]
    },
    'echogenic_foci': {
        'classes': ['none', 'macrocalcifications', 'peripheral', 'punctate_echogenic_foci', 'microcalcifications'],
        'points': [0, 1, 2, 3, 3],
        'descriptions': [
            'None or large comet-tail artifacts',
            'Macrocalcifications',
            'Peripheral (rim) calcifications',
            'Punctate echogenic foci',
            'Microcalcifications (highly suspicious)'
        ]
    }
}

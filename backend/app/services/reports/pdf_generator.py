# app/services/reports/pdf_generator.py
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, Image, PageBreak
)
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.pagesizes import A4
from reportlab.lib.units import inch
from reportlab.lib.enums import TA_CENTER
from reportlab.lib import colors
import io
import datetime
import uuid
import matplotlib.pyplot as plt
import matplotlib.cm as cm
from app.utils.image_processing import draw_bounding_box
from app.config.model_config import model_config

class PDFReportGenerator:
    """Service to generate professional AI diagnostic reports in PDF format."""

    @staticmethod
    def _draw_confidence_graph(confidences: dict) -> io.BytesIO:
        """Generates a professional horizontal bar chart for TI-RADS probabilities."""
        # Mapping to TR labels
        labels = ["TR 1", "TR 2", "TR 3", "TR 4", "TR 5"]
        values = [confidences.get(f"TIRADS_{i+1}", 0) * 100 for i in range(5)]
        
        # Professional HEX colors (Sync with report scale)
        risk_colors = ["#7AC27D", "#C1E1C1", "#F9E2AF", "#FDAD4E", "#F94144"]

        plt.figure(figsize=(6, 2.5))
        bars = plt.barh(labels, values, color=risk_colors, height=0.6)
        
        # Minimalist styling
        plt.gca().invert_yaxis() # TR1 at top
        plt.gca().spines['top'].set_visible(False)
        plt.gca().spines['right'].set_visible(False)
        plt.gca().spines['bottom'].set_visible(False)
        plt.gca().xaxis.set_visible(False)
        
        # Add labels to bars
        for bar in bars:
            width = bar.get_width()
            plt.text(
                width + 1, 
                bar.get_y() + bar.get_height()/2, 
                f'{width:.1f}%', 
                va='center', 
                fontsize=9, 
                fontweight='bold',
                color="#2d3748"
            )

        plt.title("Probability Distribution (TI-RADS Categorization)", loc='left', fontsize=10, fontweight='bold', color="#1a365d", pad=15)
        plt.tight_layout()

        buf = io.BytesIO()
        plt.savefig(buf, format='png', dpi=150, transparent=True)
        plt.close()
        buf.seek(0)
        return buf

    @staticmethod
    def _draw_gradcam_legend() -> io.BytesIO:
        """Generates a small horizontal color bar legend for Grad-CAM heatmap."""
        # Create a horizontal colorbar with enough top margin for the title
        fig, ax = plt.subplots(figsize=(3, 0.6))
        fig.subplots_adjust(bottom=0.5, top=0.7) # Added top margin for title

        norm = plt.Normalize(vmin=0, vmax=1)
        cb = fig.colorbar(
            cm.ScalarMappable(norm=norm, cmap='jet'),
            cax=ax, 
            orientation='horizontal',
            ticks=[0, 0.5, 1]
        )
        cb.ax.set_xticklabels(['Low', 'Medium', 'High'], fontsize=8)
        cb.outline.set_visible(False)
        ax.tick_params(size=0)
        
        plt.title("Activation Level", loc='center', fontsize=8, pad=6, fontweight='bold', color="#4a5568")

        buf = io.BytesIO()
        plt.savefig(buf, format='png', dpi=150, transparent=True)
        plt.close()
        buf.seek(0)
        return buf

    @staticmethod
    def _header_footer(canvas, doc, report_id):
        """Draws the header and footer on each page."""
        canvas.saveState()
        
        # --- Header ---
        # Logo
        try:
            import os
            logo_path = os.path.join(os.getcwd(), "app", "assets", "logo.png")
            if os.path.exists(logo_path):
                # Adjusted Y to 798 for better vertical alignment with the 14pt title
                canvas.drawImage(logo_path, 40, 798, width=22, height=22, mask='auto', preserveAspectRatio=True)
                title_x = 68
            else:
                title_x = 40
        except Exception as e:
            print(f"Warning: Could not load header logo: {e}")
            title_x = 40

        canvas.setFont("Helvetica-Bold", 14)
        canvas.drawString(title_x, 810, "ThyroVision")
        
        canvas.setFont("Helvetica-Oblique", 9)
        canvas.setFillColor(colors.HexColor("#4a5568")) # Darker grey
        canvas.drawString(title_x, 796, "Radiology Wingman")
        canvas.setFillColor(colors.black)

        canvas.setFont("Helvetica", 9)
        canvas.drawRightString(555, 810, "AI Diagnostic Report")
        canvas.drawRightString(555, 798, f"Report ID: {report_id}")
        canvas.drawRightString(555, 786, f"Data: {datetime.date.today().strftime('%d %b %Y')}")

        canvas.setStrokeColor(colors.grey)
        canvas.setLineWidth(0.5)
        canvas.line(40, 780, 555, 780)

        # --- Footer ---
        canvas.setFont("Helvetica", 7)
        canvas.setFillColor(colors.grey)
        disclaimer = (
            "IMPORTANT: This AI-generated report is intended for clinical decision support only. "
            "Final diagnosis rests with qualified healthcare professionals."
        )
        canvas.drawString(40, 30, disclaimer)
        canvas.drawRightString(555, 30, f"Page {doc.page}")
        
        canvas.restoreState()

    @classmethod
    def generate_pdf(cls, data: dict, raw_image_bytes: bytes, gradcam_bytes: bytes = None) -> bytes:
        """Generates a complete PDF report from prediction data and image bytes."""
        buffer = io.BytesIO()
        
        # --- Data Extraction ---
        patient = data.get("patient", {})
        pred = data.get("prediction", {})
        
        # Prioritize prediction["report_id"] from DB, fallback to random if missing
        report_id = pred.get("report_id") or f"THY-{uuid.uuid4().hex[:8].upper()}"

        doc = SimpleDocTemplate(
            buffer,
            pagesize=A4,
            rightMargin=40,
            leftMargin=40,
            topMargin=60, # Reduced from 80
            bottomMargin=40 # Reduced from 50
        )

        styles = getSampleStyleSheet()
        section_style = ParagraphStyle(
            "section",
            parent=styles["Heading2"],
            fontSize=10.5, # Slightly reduced from 11
            fontName="Helvetica-Bold",
            spaceBefore=10, # Reduced from 14
            spaceAfter=4,  # Reduced from 6
            textColor=colors.HexColor("#1a365d") # Professional dark blue
        )
        
        normal_style = styles["Normal"]
        elements = []

        features = pred.get("features", {})
        bbox = pred.get("bounding_box") or pred.get("bbox")

        # --- Section 1: Patient Information ---
        elements.append(Paragraph("Section 1 – Patient Information", section_style))
        patient_data = [
            ["Patient Name", patient.get("name", "N/A")],
            ["Age / Gender", f"{patient.get('age', 'N/A')} / {patient.get('gender', 'N/A')}"],
            ["Examination Date", datetime.date.today().strftime("%d %b %Y")]
        ]
        pt_table = Table(patient_data, colWidths=[2 * inch, 4 * inch])
        pt_table.setStyle(TableStyle([
            ('LINEBELOW', (0, 0), (-1, -1), 0.25, colors.grey),
            ('FONTNAME', (0, 0), (0, -1), 'Helvetica-Bold'),
            ('LEFTPADDING', (0, 0), (-1, -1), 6),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 4), # Reduced from 6
            ('TOPPADDING', (0, 0), (-1, -1), 4),
        ]))
        elements.append(pt_table)

        # --- Section 2: Clinical Summary ---
        elements.append(Paragraph("Section 2 – Clinical Summary", section_style))
        
        tirads_val = pred.get('tirads', 1)
        try:
            tirads_score = int(tirads_val)
        except (ValueError, TypeError):
            tirads_score = 1
            
        confidence = float(pred.get("confidence", 0)) * 100
        
        # Summary Table (Text)
        summary_data = [[
            f"TI-RADS Score: {tirads_score}",
            f"Confidence: {confidence:.1f}%"
        ]]
        summ_table = Table(summary_data, colWidths=[3 * inch, 3 * inch])
        summ_table.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (-1, -1), colors.whitesmoke),
            ('FONTNAME', (0, 0), (-1, -1), 'Helvetica-Bold'),
            ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 6), # Reduced from 10
            ('TOPPADDING', (0, 0), (-1, -1), 6),    # Reduced from 10
        ]))
        elements.append(summ_table)
        elements.append(Spacer(1, 4)) # Reduced from 8

        # --- TI-RADS Risk Scale (Color Bar) ---
        risk_colors = [
            colors.HexColor("#7AC27D"), # TR1: Benign (Lighter green)
            colors.HexColor("#C1E1C1"), # TR2: Not Suspicious
            colors.HexColor("#F9E2AF"), # TR3: Mildly Suspicious
            colors.HexColor("#FDAD4E"), # TR4: Moderately Suspicious
            colors.HexColor("#F94144")  # TR5: Highly Suspicious
        ]
        
        indicators = ["", "", "", "", ""]
        if 1 <= tirads_score <= 5:
            indicators[tirads_score - 1] = "▼"
            
        scale_data = [
            indicators,
            ["TR 1", "TR 2", "TR 3", "TR 4", "TR 5"],
            ["Benign", "Not Susp.", "Mildly Susp.", "Mod. Susp.", "Highly Susp."]
        ]
        
        scale_table = Table(scale_data, colWidths=[1.1 * inch] * 5)
        
        scale_styles = [
            ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
            ('FONTSIZE', (0, 0), (-1, 0), 8), # Reduced arrow size
            ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
            ('FONTSIZE', (0, 1), (-1, 1), 8), # TR Labels
            ('FONTNAME', (0, 1), (-1, 1), 'Helvetica-Bold'),
            ('FONTSIZE', (0, 2), (-1, 2), 6), # Descriptions
            ('BOTTOMPADDING', (0, 0), (-1, -1), 1),
            ('TOPPADDING', (0, 0), (-1, -1), 1),
        ]
        
        for i in range(5):
            scale_styles.append(('BACKGROUND', (i, 1), (i, 1), risk_colors[i]))
            if i >= 3:
               scale_styles.append(('TEXTCOLOR', (i, 1), (i, 1), colors.white))
            
            if i == tirads_score - 1:
                scale_styles.append(('BOX', (i, 1), (i, 1), 1.5, colors.black))
                scale_styles.append(('FONTNAME', (i, 2), (i, 2), 'Helvetica-Bold'))

        scale_table.setStyle(TableStyle(scale_styles))
        elements.append(scale_table)
        
        elements.append(Spacer(1, 2)) # Reduced from 4
        elements.append(Paragraph(f"Model ID: {pred.get('model_version', model_config.pipeline_version)}", ParagraphStyle("small", fontSize=7, textColor=colors.grey)))

        # --- Section 3: Ultrasound Findings ---
        elements.append(Paragraph("Section 3 – Ultrasound Findings", section_style))
        feature_rows = [["Feature", "Observation"]]
        
        # Helper to format labels
        def format_lbl(s):
            return str(s).replace("_", " ").title()

        # Handle nested Structure if present
        clinical_features = features.get("clinical_features", {})
        measurements = features.get("measurements", {})

        if clinical_features:
            # Add Clinical Features
            for k, v in clinical_features.items():
                val = v.get("value") if isinstance(v, dict) else v
                feature_rows.append([format_lbl(k), format_lbl(val)])
        else:
            # Fallback for old flat data
            for k, v in features.items():
                if k not in ["clinical_features", "measurements", "total_points"]:
                    feature_rows.append([format_lbl(k), format_lbl(v)])
        
        f_table = Table(feature_rows, colWidths=[2.5 * inch, 3.5 * inch])
        f_table.setStyle(TableStyle([
            ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
            ('BACKGROUND', (0, 0), (-1, 0), colors.whitesmoke),
            ('LINEBELOW', (0, 0), (-1, -1), 0.25, colors.grey),
            ('LEFTPADDING', (0, 0), (-1, -1), 6),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 3), # Reduced padding
            ('TOPPADDING', (0, 0), (-1, -1), 3),
        ]))
        elements.append(f_table)

        # --- Section 4: AI Interpretation ---
        elements.append(Paragraph("Section 4 – AI Interpretation", section_style))
        explanation = pred.get("ai_explanation") or pred.get("explanation", "No detailed interpretation generated.")
        
        exp_table = Table([[Paragraph(explanation, normal_style)]], colWidths=[6 * inch])
        exp_table.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (-1, -1), colors.whitesmoke),
            ('LEFTPADDING', (0, 0), (-1, -1), 8),  # Reduced from 10
            ('RIGHTPADDING', (0, 0), (-1, -1), 8), # Reduced from 10
            ('TOPPADDING', (0, 0), (-1, -1), 6),    # Reduced from 10
            ('BOTTOMPADDING', (0, 0), (-1, -1), 6), # Reduced from 10
        ]))
        elements.append(exp_table)

        # --- Section 5: Imaging ---
        elements.append(Paragraph("Section 5 – Imaging", section_style))

        img_w, img_h = 2.7 * inch, 2.7 * inch # Slightly reduced for a safer single-page fit
        img1 = Image(io.BytesIO(raw_image_bytes), width=img_w, height=img_h)
        
        if bbox:
            boxed_bytes = draw_bounding_box(raw_image_bytes, bbox)
            img2 = Image(io.BytesIO(boxed_bytes), width=img_w, height=img_h)
        else:
            img2 = Paragraph("Nodule localization not available.", normal_style)

        # Professional Image Table with Borders
        img_table_data = [
            [img1, img2],
            ["[Original Ultrasound Scan]", "[AI-Annotated Scan]"]
        ]
        
        img_table = Table(img_table_data, colWidths=[3.1 * inch, 3.1 * inch])
        img_table.setStyle(TableStyle([
            ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
            ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
            # Adding box around images to look more "medical monitor" like
            ('BOX', (0, 0), (0, 0), 1, colors.black),
            ('BOX', (1, 0), (1, 0), 1, colors.black),
            ('FONTNAME', (0, 1), (-1, 1), 'Helvetica-Oblique'),
            ('FONTSIZE', (0, 1), (-1, 1), 7.5),
            ('TOPPADDING', (0, 1), (-1, 1), 5),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 4), # Reduced from 8
        ]))
        elements.append(img_table)

        # --- PAGE BREAK: PAGE 2 ---
        elements.append(PageBreak())

        # --- Section 6: AI Explainability (Page 2) ---
        elements.append(Paragraph("Section 6 – AI Explainability (Advanced Visualization)", section_style))
        
        explainability_desc = (
            "Explainability maps (Grad-CAM) highlight specific visual patterns that the AI "
            "model identified as most significant for this classification. High-activation areas (Red) "
            "indicate features used by the model to determine the final TI-RADS score."
        )
        elements.append(Paragraph(explainability_desc, normal_style))
        elements.append(Spacer(1, 12))

        if gradcam_bytes:
            gc_img = Image(io.BytesIO(gradcam_bytes), width=4.5 * inch, height=4.5 * inch)
            gc_table = Table([[gc_img]], colWidths=[6 * inch])
            gc_table.setStyle(TableStyle([
                ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
                ('BOX', (0, 0), (-1, -1), 1, colors.black),
                ('TOPPADDING', (0, 0), (-1, -1), 0),
                ('BOTTOMPADDING', (0, 0), (-1, -1), 0),
            ]))
            elements.append(gc_table)
            
            # Add Horizontal Legend under the image with better spacing
            elements.append(Spacer(1, 8))
            legend_buf = cls._draw_gradcam_legend()
            legend_img = Image(legend_buf, width=2.5 * inch, height=0.5 * inch) # Increased height for title
            
            legend_table = Table([[legend_img]], colWidths=[6 * inch])
            legend_table.setStyle(TableStyle([
                ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
            ]))
            elements.append(legend_table)
            elements.append(Spacer(1, 4))
            
            elements.append(Paragraph("[AI Explainability Map – Attention Heatmap Overlay]", ParagraphStyle("small", fontSize=7, alignment=TA_CENTER, textColor=colors.grey)))
        else:
            elements.append(Paragraph("Grad-CAM visualization not available for this session.", normal_style))

        elements.append(Spacer(1, 20))

        # --- Section 7: Confidence Distribution ---
        elements.append(Paragraph("Section 7 – Model Confidence Distribution", section_style))
        
        tirads_confidences = pred.get("tirads_confidences", {})
        if tirads_confidences:
            graph_buf = cls._draw_confidence_graph(tirads_confidences)
            graph_img = Image(graph_buf, width=6 * inch, height=2.5 * inch)
            elements.append(graph_img)
        else:
            elements.append(Paragraph("Probabilistic breakdown not available.", normal_style))

        elements.append(Spacer(1, 20))
        elements.append(Paragraph("Note: Proximity between categories indicates clinical boundary cases.", ParagraphStyle("small", fontSize=8, textColor=colors.grey)))

        def on_page(canvas, doc):
            cls._header_footer(canvas, doc, report_id)

        doc.build(elements, onFirstPage=on_page, onLaterPages=on_page)
        
        buffer.seek(0)
        return buffer.getvalue()

# Use official lightweight Python image
FROM python:3.11.9-slim

# Set environment variables
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PORT=8000

# Set work directory
WORKDIR /app

# Install system dependencies required by python modules
RUN apt-get update && apt-get install -y --no-install-recommends \
    curl \
    build-essential \
    && rm -rf /var/lib/apt/lists/*

# Copy requirements file
COPY requirements.txt .

# Build argument to allow installing CPU-only PyTorch by default
# This saves significant download size/time on systems without GPUs
ARG PYTORCH_CPU=true

# Install dependencies
RUN pip install --no-cache-dir --upgrade pip && \
    if [ "$PYTORCH_CPU" = "true" ] ; then \
        pip install --no-cache-dir torch torchvision --index-url https://download.pytorch.org/whl/cpu ; \
    fi && \
    pip install --no-cache-dir -r requirements.txt

# Copy backend files
COPY . .

# Expose default API port
EXPOSE 8000

# Run the FastAPI server using uvicorn (using a single worker to optimize ML inference memory usage)
CMD ["sh", "-c", "uvicorn main:app --host 0.0.0.0 --port ${PORT} --workers 1"]
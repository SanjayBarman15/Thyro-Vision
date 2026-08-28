```
cd backend
```
```
python -m venv venv
```
```
venv\Scripts\activate
```
---
or
---
```
.\venv\Scripts\Activate.ps1
```
```
pip install -r requirements.txt
```
```
uvicorn main:app --reload --port 8000
uvicorn main:app --host 0.0.0.0 --port $PORT
```
```
deactivate
```

```
cd backend
venv\Scripts\activate
celery -A app.tasks.celery_app worker --loglevel=info --pool=solo
celery -A app.tasks.celery_app worker --loglevel=info --pool=solo -n worker1@%h
celery -A app.tasks.celery_app worker -Q ml_tasks --pool=solo -n worker_ml@%h
celery -A app.tasks.celery_app worker -Q notifications --pool=solo -n worker_notify@%h
deactivate
```
.\venv\Scripts\python -c "import os; import redis; from dotenv import load_dotenv; load_dotenv(); r = redis.from_url(os.getenv('REDIS_URL'), decode_responses=True); r.delete('benchmark:last_run'); r.delete('benchmark:lock'); print('✅ All locks cleared')"


//dev
fastapi
uvicorn
python-multipart
supabase
python-dotenv
pydantic
pillow
google-genai
reportlab

#Xception model
# tensorflow>=2.10.0
torch>=1.10.0
torchvision>=0.11.0
timm>=0.6.0
opencv-python-headless>=4.5.0
numpy>=1.21.0
scikit-learn>=1.0.0
matplotlib>=3.5.0
Pillow>=8.0.0

# For XML parsing
lxml


//prod
fastapi
uvicorn
python-multipart
supabase
python-dotenv
pydantic
pillow
google-genai
reportlab

# ML / Inference (CPU only – torch installed separately)
timm>=0.6.0
opencv-python-headless>=4.5.0
numpy>=1.21.0
scikit-learn>=1.0.0
matplotlib>=3.5.0
Pillow>=8.0.0
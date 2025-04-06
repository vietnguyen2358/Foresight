# Foresight

## Requirements
**Frontend**
* Next.JS
* TailwindCSS
* Leaflet
* ShadCN
* Framer Motion

**Backend**
* Python  3.11.11
* FastAPI
* Uvicorn
* YOLOV11
* Google Gemini (API Keys required)
* Groq (Add or remove accordingly)
* Twilio (Add or remove accordingly)
* ChromaDB 
* OpenCV
* Ngrok (Add or remove accordingly)

## Storing API Keys
Remove .example from .env and place API Keys inside
```
.env.example --> .env
```

## Backend Setup
Clone the repository
```
git clone git@github.com:vietnguyen2358/Foresight.git
```
Create a virtual venv called
```
#for windows
python -m venv winEnv
#for mac
python3 -m venv macEnv
```
Activate your virtual environment
```
#for windows
source winEnv/Scripts/activate
#for mac
source macEnv/bin/activate
```
Enter the backend folder and install requirements
```
cd backend
pip install -r requirements.txt
```
Running the backend server
```
python3 main.py
```

## Frontend Setup
Enter frontend/sfhacksfinal folder and install dependencies
```
cd frontend/sfhacksfinal
npm install
```
Running the frontend server
```
npm run dev
```
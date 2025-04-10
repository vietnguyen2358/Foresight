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
* Google Gemini (API Key required)
* Groq (API Key required)
* Twilio (Twilio Number required)
* MongoDB Atlas
* OpenCV
* Ngrok 

## Storing API Keys
Remove .example from .env and place API Keys inside
```
.env.example --> .env
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

## Backend Setup
Clone the repository
```
git clone git@github.com:vietnguyen2358/Foresight.git
```
Create a virtual venv called
```
#for windows
python -m venv venv
#for mac
python3 -m venv venv
```
Activate your virtual environment
```
#for windows
source venv/Scripts/activate
#for mac
source venv/bin/activate
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

## Ngrok
Once the backend server is running, expose its endpoints with ngrok
```
ngrok http 8000
```
Copy the forwarding url for http://localhost:8000

## Twilio Integration Setup
* Obtain a Twilio number at https://www.twilio.com/console <br />
* Navigate to Active Numbers in Twilio's console and open its configuration page <br />
* Voice Configuration: 
  * Configure call ins with Webhook
  * Paste ngrok forwarding url

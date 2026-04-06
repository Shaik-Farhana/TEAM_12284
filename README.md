# FocusADHD 🧠⚡

**Team ID: 12284 | Developed by: Ummul Faiz and team**

![FocusADHD Banner](https://img.shields.io/badge/Status-Active-brightgreen) ![License](https://img.shields.io/badge/License-MIT-blue)

FocusADHD is an adaptive, AI-powered educational platform specifically engineered to transform how users with ADHD interact with digital learning. By abandoning the traditional "wall-of-text" textbook approach, FocusADHD delivers dynamic, bite-sized micro-learning that responds in real-time to the user's attention span.

---

## ❓ The "Why": The Problem We Are Solving

Traditional e-learning platforms are built for neurotypical learners. For individuals with ADHD, retaining focus while reading dense paragraphs or watching long, un-interactive videos leads to cognitive overload, rapid distraction, and frustration. Standard platforms do not adapt when a user stops paying attention. 

We built **FocusADHD** because digital education should seamlessly adapt to the learner's brain, not the other way around. 

## 💡 The "What": Our Solution

FocusADHD is a highly interactive, multimodal learning environment that teaches any topic using adaptive AI. 
Instead of giving the user a static article, the platform:
1. Streams continuous, short-form conversational lessons.
2. Monitors user engagement in the background (tab visibility, reading speed, idle time).
3. Adapts the content mid-lesson if it detects the user is "Drifting" or "Overloaded" (e.g., pivoting to shorter sentences, changing the tone, or providing eye-catching illustrations).
4. Frequently checks comprehension using interactive micro-assessments. 

## ⚙️ The "How": Key Features

- **Real-Time Focus Tracking:** Monitors user engagement invisibly to calculate exact "Focus Time" vs. "Distraction Time" for robust session analytics.
- **State-Based Content Adaptation:** If the system detects a loss of focus, the subsequent AI-generated chunks automatically adapt to reclaim attention (unexpected hooks, radical simplification, bullet points).
- **Embedded Micro-Assessments:** Automatically injects multiple-choice questions natively into the learning stream to ensure comprehension before advancing.
- **Multimodal Delivery:** Offers a customized learning layout featuring Dark Mode, high-contrast options, font sizing, and motion reduction.
- **Visual & Auditory Support:** Generates accurate educational illustrations dynamically, alongside high-fidelity Text-to-Speech audio reading.

---

## 🏗️ Comprehensive Tech Stack

We leveraged a modern, distributed architecture leaning heavily on Google Cloud Platform for our intelligence layer and Supabase for real-time state management.

### 🎨 Frontend (Client Interface)
- **React 18:** Component-based UI formulation.
- **Vite:** Next-generation frontend tooling and rapid bundling.
- **TailwindCSS:** Utility-first CSS framework for highly responsive and accessible styling.
- **Server-Sent Events (SSE):** Streaming interface to consume text chunks from the AI live.
- **Lucide React:** Iconography.

### 🔌 Backend (API & Core Logic)
- **Python 3.10+:** Core scripting logic.
- **FastAPI:** High-performance async API framework handling the SSE streams and REST endpoints.
- **SQLAlchemy:** Fully fledged ORM to map Python objects to PostgreSQL tables.
- **Uvicorn:** ASGI web server caching and hosting the FastAPI runtime.
- **Pydantic:** Strictly enforced data validation schema engine.

### 🧠 Intelligence & Infrastructure (Google Cloud Platform)
Our application's "brain" and heavy asset lifting is powered entirely by GCP services:
- **Vertex AI (Gemini 2.5 Flash):** The core reasoning engine. It takes the topic, the user's current statistical state, and the conversation history to stream the adaptive educational chunks.
- **Vertex AI (Imagen 3):** Prompted automatically by the Text Agent to generate custom, high-quality educational diagrams based on the current context.
- **Cloud Text-to-Speech (TTS):** Transforms the Gemini text output into natural-sounding audio streams (allowing users to listen instead of read).
- **Google Cloud Storage (GCS):** All dynamically generated images and audio files are securely piped and stored into GCS buckets. The application logic automatically generates time-limited `Signed URLs` to hand back to the client.
- **Google Cloud Run:** Fully managed serverless execution environment to host our Dockerized backend API.
- **Cloud Build:** CI/CD pipeline integrated directly via `cloudbuild.yaml` to deploy to Cloud Run automatically.

### 🗄️ Database & Authentication (Supabase)
- **PostgreSQL:** The core database instance holding User Profiles, Settings, Learning Sessions, Session Content, and granular Behavior Events.
- **Row Level Security (RLS):** Policies securing user data so learners can only ever pull analytics and sessions linked to their distinct UUID.
- **Supabase Authentication:** Secure JWT-based routing seamlessly integrated into the FastAPI backend dependency injections.

---

## 🚀 Local Development Setup

### Prerequisites
- Node.js (v18+)
- Python (3.10+)
- A [Supabase](https://supabase.com/) project
- A [Google Cloud Platform (GCP)](https://console.cloud.google.com/) Project with a Service Account and enabled APIs (Vertex AI, Cloud TTS, Cloud Storage).

### 1. Database Setup (Supabase)
Navigate to your Supabase SQL editor and run the migrations located in `focusadhd-backend/supabase/migrations/001_initial_schema.sql` to generate the required tables.

### 2. Backend Setup
```bash
# Navigate to backend
cd focusadhd-backend

# Create and activate virtual environment
python -m venv venv
source venv/Scripts/activate  # Windows
# source venv/bin/activate    # Mac/Linux

# Install dependencies
pip install -r requirements.txt
```

#### Backend Configuration
Create a `.env` file inside `focusadhd-backend/`:
```env
# Supabase
DATABASE_URL="postgres://..."
SUPABASE_URL="https://..."
SUPABASE_ANON_KEY="..."
SUPABASE_SERVICE_ROLE_KEY="..."
SUPABASE_JWT_SECRET="..."

# GCP
GEMINI_API_KEY="..."
GOOGLE_APPLICATION_CREDENTIALS="path/to/your/cred.json"
GOOGLE_CLOUD_PROJECT="your-gcp-project-id"
GOOGLE_CLOUD_REGION="us-central1"
GCP_STORAGE_BUCKET="your-bucket-name"

# App
ENVIRONMENT="development"
CORS_ORIGINS="http://localhost:5173"
```

Start the backend server:
```bash
uvicorn app.main:app --reload
```

### 3. Frontend Setup
```bash
# Navigate to frontend
cd focusadhd-frontend

# Install dependencies
npm install
```

#### Frontend Configuration
Create a `.env` file inside `focusadhd-frontend/`:
```env
VITE_SUPABASE_URL="https://..."
VITE_SUPABASE_ANON_KEY="..."
VITE_API_URL="http://localhost:8000"
```

Start the frontend development server:
```bash
npm run dev
```

---

## 📄 License
This project was built as an academic capstone. All rights reserved.

import sys
import os

# Ensure project root is on sys.path for Vercel Serverless environment
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from backend.app.main import app

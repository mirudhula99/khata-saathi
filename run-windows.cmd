@echo off
REM Khata Saathi (FastAPI build) on Windows. Double-click this file, then open http://localhost:8000
REM Uses the Windows virtualenv .venv-win (Python 3.12). The .venv folder is the Mac one; ignore it.
cd /d "%~dp0"
if not exist ".venv-win\Scripts\python.exe" (
  echo .venv-win not found. Create it with:  py -3.12 -m venv .venv-win  then  .venv-win\Scripts\python -m pip install -r requirements.txt
  pause
  exit /b 1
)
echo Starting Khata Saathi on http://localhost:8000  (Ctrl+C to stop)
".venv-win\Scripts\python.exe" -m uvicorn app.main:app --port 8000
pause

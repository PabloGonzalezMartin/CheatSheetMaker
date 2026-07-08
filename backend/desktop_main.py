import sys
import uvicorn
from app.main import app

if __name__ == "__main__":
    port = int(sys.argv[1]) if len(sys.argv) > 1 else 8723
    uvicorn.run(app, host="127.0.0.1", port=port)

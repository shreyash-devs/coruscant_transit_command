import sys
import os
# Add the backend directory to the path so we can import utils
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), 'backend')))

from utils import get_event
from datetime import datetime

def test_events():
    print("--- Testing Event Detection Logic ---")
    
    # Test 1: Weekend
    print(f"Testing 2026-04-05 (Easter Sunday): {get_event('2026-04-05')}")
    
    # Test 2: Maharashtra Day (May 1)
    print(f"Testing 2026-05-01 (Maharashtra Day): {get_event('2026-05-01')}")
    
    # Test 3: Normal Weekday (Monday April 6)
    print(f"Testing 2026-04-06 (Monday): {get_event('2026-04-06')}")
    
    # Test 4: Wednesday Market Day (Simulation Mode)
    print(f"Testing 2026-04-08 (Wednesday): {get_event('2026-04-08')}")

if __name__ == "__main__":
    test_events()

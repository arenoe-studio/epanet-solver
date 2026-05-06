from api.server.handlers.diameter import analyze_diameter
from pathlib import Path
import json

data = Path('temp.inp').read_bytes()
result = analyze_diameter(data, 'temp.inp', max_iterations=10, time_budget_s=30.0)

# Print struktur top-level keys
print('TOP LEVEL KEYS:', list(result.keys()))
print()

# Print sample node
if result.get('nodes'):
    print('SAMPLE NODE:', json.dumps(result['nodes'][0], indent=2))

# Print sample pipe  
if result.get('pipes'):
    print('SAMPLE PIPE:', json.dumps(result['pipes'][0], indent=2))

# Print sample remainingError
if result.get('remainingErrors'):
    print('SAMPLE ERROR:', json.dumps(result['remainingErrors'][0], indent=2))

# Print summary
print('SUMMARY:', json.dumps(result.get('summary'), indent=2))

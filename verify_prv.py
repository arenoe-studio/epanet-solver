from api.server.handlers.pressure import analyze_pressure
from pathlib import Path
import json

data = Path('userdocs/Jaringan Distribusi Uji 2.inp').read_bytes()
result = analyze_pressure(data, 'Jaringan Distribusi Uji 2.inp')
print('success:', result.get('success'))
print('addPrvAvailable:', result.get('addPrvAvailable'))
print('nodes count:', len(result.get('nodes', [])))
print('remainingErrors count:', len(result.get('remainingErrors', [])))

"""Publish preferred upstream source, build inputs and the exact adapted runtime."""
import io
import json
from pathlib import Path
import subprocess
import zipfile

ROOT = Path(__file__).resolve().parents[2]
HERE = Path(__file__).resolve().parent
games = json.loads((HERE / 'SOURCES.json').read_text(encoding='utf-8'))
for game in games:
    checkout = ROOT / 'game-sources/upstream/classics' / game['folder']
    # Only the JavaScript edition is distributed, not the unrelated desktop,
    # Java or Flash programs in the same XiangQi upstream repository.
    args = ['git', 'archive', '--format=zip', game['commit']]
    if game['recipe'] == 'xiangqi':
        args += ['JavaScript', 'LICENSE', 'README.md']
    original = subprocess.run(args, cwd=checkout, check=True, capture_output=True).stdout
    runtime = ROOT / 'public/games' / game['id']
    output = runtime / 'source.zip'
    omitted = []
    with zipfile.ZipFile(io.BytesIO(original)) as source, zipfile.ZipFile(output, 'w', zipfile.ZIP_DEFLATED, compresslevel=9) as archive:
        for item in source.infolist():
            name = item.filename
            if item.is_dir():
                continue
            # These fonts/recordings are unused by the adapted runtime. Build
            # source remains present; replacement tones are readable JavaScript.
            if ('/fonts/' in '/' + name or (game['recipe'] in {'asteroids','xiangqi'} and Path(name).suffix.lower() == '.wav') or name == 'vector_battle_regular.typeface.js'):
                omitted.append(name)
                continue
            archive.writestr('upstream/' + name, source.read(item))
        for file in sorted(runtime.rglob('*')):
            if file.is_file() and file.name not in {'source.zip','cover.png'}:
                archive.write(file, 'runtime/games/' + game['id'] + '/' + file.relative_to(runtime).as_posix())
        for name in ['game-help.js','expansion-LICENSE']:
            archive.write(ROOT / 'public/games/_shared' / name, 'runtime/games/_shared/' + name)
        for file in sorted(HERE.rglob('*')):
            if file.is_file() and file.suffix != '.pyc':
                archive.write(file, 'adaptations/' + file.relative_to(HERE).as_posix())
        archive.write(ROOT / 'CLASSIC_GAMES.md', 'CLASSIC_GAMES.md')
        archive.write(ROOT / 'THIRD_PARTY_NOTICES.md', 'THIRD_PARTY_NOTICES.md')
        archive.writestr('BUILD.md', f'''# {game['title']}

Upstream: https://github.com/{game['repo']}
Pinned commit: {game['commit']}
License: {game['license']}, see runtime/games/{game['id']}/LICENSE.

runtime/ is the exact adapted static package. Run
python -m http.server 8080 --directory runtime
and open http://localhost:8080/games/{game['id']}/index.html .

upstream/ contains the preferred source at the recorded commit. Normal hall
builds serve committed runtimes without rebuilding third-party programs.
adaptations/ contains import-games.mjs, pinned build inputs and the source
packager. See adaptations/README.md for rebuilding the two compiled games;
prepare-builds.mjs selects Chinese by default for Minesweeper and replaces
obsolete node-sass for BreakLock. The original sources remain separate.
For other games the readable runtime is also the editable adapted source.
Chinese Chess originally uses GBK: import-games.mjs converts it to UTF-8.

Unused fonts/audio omitted from the archive:
{chr(10).join(omitted)}
''')
    with zipfile.ZipFile(output) as archive:
        assert archive.testzip() is None
        assert f'runtime/games/{game["id"]}/index.html' in archive.namelist()
    assert output.stat().st_size <= 25 * 1024 * 1024
    print(f'{game["id"]}: {output.stat().st_size / 1024 / 1024:.2f} MiB')

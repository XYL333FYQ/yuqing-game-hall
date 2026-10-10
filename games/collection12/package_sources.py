"""Package pinned editable source, adapted source and the shipped runtime."""
import io
import json
from pathlib import Path
import subprocess
import zipfile

ROOT = Path(__file__).resolve().parents[2]
HERE = Path(__file__).resolve().parent
for game in json.loads((HERE / 'SOURCES.json').read_text(encoding='utf-8')):
    checkout = ROOT / 'game-sources/upstream/next12' / game['folder']
    original = subprocess.run(['git', 'archive', '--format=zip', game['commit']], cwd=checkout, check=True, capture_output=True).stdout
    runtime = ROOT / 'public/games' / game['id']
    output = runtime / 'source.zip'
    omitted = []
    with zipfile.ZipFile(io.BytesIO(original)) as source, zipfile.ZipFile(output, 'w', zipfile.ZIP_DEFLATED, compresslevel=9) as archive:
        for item in source.infolist():
            n = item.filename
            if item.is_dir():
                continue
            skip = '/fonts/' in '/' + n or 'wenxue.' in n
            if game['folder'] == 'mah':
                skip |= any(n.startswith('src/assets/' + folder + '/') for folder in ['music','img','backgrounds'])
                skip |= n.startswith('src/assets/svg/') and Path(n).name not in ['uni.svg','uni-black.svg','README.md']
            if skip:
                omitted.append(n)
                continue
            archive.writestr('upstream/' + n, source.read(item))
        if game['folder'] in ['mah','nonograms','solitaire','battleship']:
            for file in sorted((checkout / 'src').rglob('*')):
                if file.is_file() and file.relative_to(checkout).as_posix() not in omitted:
                    archive.write(file, 'adapted-source/' + file.relative_to(checkout).as_posix())
            for name in ['package.json','package-lock.json','angular.json','custom-build-config.json']:
                file = checkout / name
                if file.exists():
                    archive.write(file, 'adapted-source/' + name)
        for file in sorted(runtime.rglob('*')):
            if file.is_file() and file.name not in ['source.zip','cover.png']:
                archive.write(file, 'runtime/games/' + game['id'] + '/' + file.relative_to(runtime).as_posix())
        for name in ['game-help.js','expansion-LICENSE']:
            archive.write(ROOT / 'public/games/_shared' / name, 'runtime/games/_shared/' + name)
        for file in sorted(HERE.rglob('*')):
            if file.is_file() and file.suffix != '.pyc':
                archive.write(file, 'adaptations/' + file.relative_to(HERE).as_posix())
        for name in ['COLLECTION12_GAMES.md','THIRD_PARTY_NOTICES.md']:
            archive.write(ROOT / name, name)
        archive.writestr('BUILD.md', f"""# {game['title']}

Upstream: https://github.com/{game['repo']}
Pinned commit: {game['commit']}
License: {game['license']}, see runtime/games/{game['id']}/LICENSE and accompanying notices.

runtime/ contains the shipped adapted static game. Serve it with:
python -m http.server 8080 --directory runtime
Open /games/{game['id']}/index.html .

upstream/ contains editable source from the pinned commit. adapted-source/
contains the modified preferred source of compiled games. adaptations/ contains
the import, build and package scripts and pinned build inputs. See its README.md
for reproducible regeneration; normal hall builds use committed runtime files.

Unused assets omitted:
{chr(10).join(omitted)}
""")
    with zipfile.ZipFile(output) as archive:
        assert archive.testzip() is None
        assert f'runtime/games/{game["id"]}/index.html' in archive.namelist()
    assert output.stat().st_size <= 25 * 1024 * 1024
    print(f'{game["id"]}: {output.stat().st_size / 1024 / 1024:.2f} MiB')

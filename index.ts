import path from "path";
import fs from "fs/promises";
import * as esbuild from 'esbuild';

async function getFilesList(repository: string) {
    const URL = `https://api.github.com/repos/${repository}/git/trees/main?recursive=1`;
    const response = await fetch(URL)
    const data = await response.json() as { tree: { mode: string; path: string }[] }
    const files = data.tree
        .filter(i => i.path.startsWith('src/'))
        .filter(i => (i.path.endsWith('.css') || i.path.endsWith('.js')))
        .filter(i => !i.path.endsWith('.test.js') && !i.path.endsWith('.stories.css'))
        .map(i => i.path);
    return files;
}

async function getFiles(files: string[], repository: string, basePath: string = './files') {
    for (const filePath of files) {
        const fileURL = `https://raw.githubusercontent.com/${repository}/main/${filePath}`;
        const response = await fetch(fileURL);
        const content = await response.text();
        const relativePath = path.relative('src/', filePath);
        const localPath = path.join(basePath, relativePath);

        console.log(filePath)

        await fs.mkdir(path.dirname(localPath), { recursive: true });
        await fs.writeFile(localPath, content);
    }
}

async function bundleFiles(files: string[], outputFileDist: string, outputFileName: string) {
    let cssFiles: string[] = files.filter(f => f.endsWith('.css')).map(f => f.replace('src/', 'files/'));
    let jsFiles: string[] = files.filter(f => f.endsWith('.js')).map(f => f.replace('src/', 'files/'));

    await fs.mkdir(outputFileDist, { recursive: true });

    // 仮想エントリーポイントを作成
    const cssEntryContent = cssFiles.map(f => `@import "${path.resolve(f)}";`).join('\n');
    const jsEntryContent = jsFiles.map(f => `import "${path.resolve(f)}";`).join('\n');

    const cssEntryPath = path.join(outputFileDist, '_entry.css');
    const jsEntryPath = path.join(outputFileDist, '_entry.js');

    await fs.writeFile(cssEntryPath, cssEntryContent);
    await fs.writeFile(jsEntryPath, jsEntryContent);

    // バンドル
    await esbuild.build({
        entryPoints: [cssEntryPath],
        bundle: true,
        minify: true,
        sourcemap: true,
        outfile: `${outputFileDist}/${outputFileName}.css`,
    });

    await esbuild.build({
        entryPoints: [jsEntryPath],
        bundle: true,
        minify: true,
        sourcemap: true,
        outfile: `${outputFileDist}/${outputFileName}.js`,
        target: ["es2020"],
    });

    // 仮想エントリーポイントを削除
    await fs.unlink(cssEntryPath);
    await fs.unlink(jsEntryPath);
}

const files = await getFilesList("digital-go-jp/design-system-example-components-html");
await getFiles(files, "digital-go-jp/design-system-example-components-html", './files');
await bundleFiles(files, './dist', 'dads-components-bundle');

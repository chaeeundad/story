import {readFileSync} from 'node:fs';
const artwork = JSON.parse(readFileSync(new URL('../src/data/essay-illustrations.json', import.meta.url)));
const assets = Object.values(artwork.assets);
const isBook = file => String(file.path || '').replaceAll('\\', '/').endsWith('/books/vol1/manuscript.md');
function walk(node, visit) { visit(node); for (const child of node.children || []) walk(child, visit); }
function content(node) { return node.value || (node.children || []).map(content).join(''); }

export function remarkBookImages() {
  return (tree, file) => {
    if (!isBook(file)) return;
    walk(tree, node => {
      if (node.type !== 'image') return;
      const asset = assets.find(a => a.source.endsWith('/' + node.url.split('/').pop()));
      if (!asset) throw new Error(`Unmapped book illustration: ${node.url}`);
      node.url = asset.src;
    });
  };
}

export function rehypeBookSections() {
  return (tree, file) => {
    if (!isBook(file)) return;
    walk(tree, node => {
      if (node.tagName !== 'img') return;
      const asset = assets.find(a => a.src === node.properties.src);
      if (!asset) throw new Error(`Missing book image dimensions: ${node.properties.src}`);
      Object.assign(node.properties, {width:asset.width, height:asset.height, loading:'lazy', decoding:'async',
        srcSet:`${asset.small} ${asset.smallWidth}w, ${asset.src} ${asset.width}w`,
        sizes:'(max-width: 700px) calc(100vw - 44px), 560px'});
    });
    const children = [];
    let section;
    for (const node of tree.children) {
      const primary = node.tagName === 'h1' || (node.tagName === 'h2' && content(node) === '감사의 말');
      if (primary) {
        section = {type:'element', tagName:'section', properties:{className:['book-section'], 'data-book-section':true, 'aria-label':content(node)}, children:[]};
        children.push(section);
        if (node.tagName === 'h1' && children.length > 1) node.tagName = 'h2';
      } else if (node.tagName === 'h2') node.tagName = 'h3';
      if (section) section.children.push(node);
      else children.push(node);
    }
    tree.children = children;
  };
}

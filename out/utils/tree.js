"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.TreeBuilder = void 0;
class TreeBuilder {
    buildTree(files, rootName) {
        const tree = this.buildTreeStructure(files, rootName);
        return `Directory structure:\n${this.renderTree(tree)}`;
    }
    buildTreeStructure(files, rootName) {
        const root = {
            name: rootName,
            isDirectory: true,
            children: new Map()
        };
        for (const file of files) {
            this.addToTree(root, file.relativePath, file.isSymlink);
        }
        return root;
    }
    addToTree(root, relativePath, isSymlink) {
        const parts = relativePath.split('/').filter(part => part);
        let current = root;
        for (let i = 0; i < parts.length; i++) {
            const part = parts[i];
            const isLastPart = i === parts.length - 1;
            if (!current.children.has(part)) {
                current.children.set(part, {
                    name: part,
                    isDirectory: !isLastPart,
                    isSymlink: isLastPart ? isSymlink : false,
                    children: new Map()
                });
            }
            current = current.children.get(part);
        }
    }
    renderTree(node, prefix = '', isLast = true) {
        const lines = [];
        // Render current node
        const connector = isLast ? '└── ' : '├── ';
        const displayName = node.isDirectory ? `${node.name}/` : node.name;
        const symlinkIndicator = node.isSymlink ? ' -> <target>' : '';
        lines.push(`${prefix}${connector}${displayName}${symlinkIndicator}`);
        // Render children
        const children = Array.from(node.children.values()).sort((a, b) => {
            // Directories first, then files
            if (a.isDirectory && !b.isDirectory)
                return -1;
            if (!a.isDirectory && b.isDirectory)
                return 1;
            return a.name.localeCompare(b.name);
        });
        children.forEach((child, index) => {
            const isLastChild = index === children.length - 1;
            const childPrefix = prefix + (isLast ? '    ' : '│   ');
            lines.push(this.renderTree(child, childPrefix, isLastChild));
        });
        return lines.join('\n');
    }
}
exports.TreeBuilder = TreeBuilder;
//# sourceMappingURL=tree.js.map
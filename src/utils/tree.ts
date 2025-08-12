import * as path from 'path';

interface FileEntry {
    relativePath: string;
    fullPath: string;
    isSymlink: boolean;
    symlinkTarget?: string;
}

export class TreeBuilder {
    buildTree(files: FileEntry[], rootName: string): string {
        const tree = this.buildTreeStructure(files, rootName);
        return `Directory structure:\n${this.renderTree(tree)}`;
    }

    private buildTreeStructure(files: FileEntry[], rootName: string): TreeNode {
        const root: TreeNode = {
            name: rootName,
            isDirectory: true,
            children: new Map()
        };

        for (const file of files) {
            this.addToTree(root, file.relativePath, file.isSymlink);
        }

        return root;
    }

    private addToTree(root: TreeNode, relativePath: string, isSymlink: boolean): void {
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
            
            current = current.children.get(part)!;
        }
    }

    private renderTree(node: TreeNode, prefix: string = '', isLast: boolean = true): string {
        const lines: string[] = [];
        
        // Render current node
        const connector = isLast ? '└── ' : '├── ';
        const displayName = node.isDirectory ? `${node.name}/` : node.name;
        const symlinkIndicator = node.isSymlink ? ' -> <target>' : '';
        
        lines.push(`${prefix}${connector}${displayName}${symlinkIndicator}`);

        // Render children
        const children = Array.from(node.children.values()).sort((a, b) => {
            // Directories first, then files
            if (a.isDirectory && !b.isDirectory) return -1;
            if (!a.isDirectory && b.isDirectory) return 1;
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

interface TreeNode {
    name: string;
    isDirectory: boolean;
    isSymlink?: boolean;
    children: Map<string, TreeNode>;
}

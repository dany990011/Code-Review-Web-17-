import React from 'react';
import { Folder, File as FileIcon, ChevronRight, ChevronDown } from 'lucide-react';
import { motion } from 'framer-motion';

/**
 * One row in the file tree. Renders itself, then recurses into its children when
 * it's an expanded folder. `level` drives the indentation. Folders start open.
 */
const FileTreeNode = ({ node, level, activeFile, onFileSelect }) => {
  const [isOpen, setIsOpen] = React.useState(true);
  const isDir = node.type === 'folder';

  return (
    <div className="w-full">
      <div 
        className={`flex items-center py-1.5 px-2 hover:bg-muted/50 cursor-pointer rounded-md text-sm transition-colors ${activeFile === node.path ? 'bg-blue-500/10 text-blue-500' : 'text-foreground'}`}
        style={{ paddingLeft: `${level * 20 + 8}px` }}
        onClick={() => isDir ? setIsOpen(!isOpen) : onFileSelect(node)}
      >
        {isDir ? (
          isOpen ? <ChevronDown className="w-4 h-4 mr-1 text-muted-foreground" /> : <ChevronRight className="w-4 h-4 mr-1 text-muted-foreground" />
        ) : (
          <span className="w-5" /> 
        )}
        
        {isDir ? <Folder className="w-4 h-4 mr-2 text-blue-400" /> : <FileIcon className="w-4 h-4 mr-2 text-muted-foreground" />}
        <span className="truncate">{node.name}</span>
      </div>
      
      {isDir && isOpen && node.children && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="relative">
          <div 
            className="absolute top-0 bottom-0 w-px bg-border/50" 
            style={{ left: `${level * 20 + 26}px` }} 
          />
          {node.children.map((child) => (
            <FileTreeNode key={child.path} node={child} level={level + 1} activeFile={activeFile} onFileSelect={onFileSelect} />
          ))}
        </motion.div>
      )}
    </div>
  );
};

/** Renders the project's file tree (nested folders/files) for the workspace. */
export default function FileExplorer({ tree, activeFile, onFileSelect }) {
  return (
    <div className="flex flex-col">
      {tree.map((node) => (
        <FileTreeNode key={node.path} node={node} level={0} activeFile={activeFile} onFileSelect={onFileSelect} />
      ))}
    </div>
  );
}

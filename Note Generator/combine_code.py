import os

def combine_project_files():
    # Name of the output file
    output_filename = "project_code_dump.txt"
    
    # Extensions to include
    valid_extensions = ['.html', '.js', '.json']
    
    # Directories to explicitly ignore
    ignored_dirs = {
        '__pycache__',
        '.git', 
        '.idea', 
        '.vscode', 
        'venv', 
        'env',
        'dist',
        'build'
    }

    # Files to explicitly ignore (including this script)
    ignored_files = {
        'combine_code.py',
        'logo_generator.html',
        output_filename,
        '.DS_Store'
    }

    print(f"Scanning directory: {os.getcwd()}")
    
    with open(output_filename, 'w', encoding='utf-8') as outfile:
        # Walk through the directory tree
        for root, dirs, files in os.walk("."):
            # Modify dirs in-place to skip ignored directories
            dirs[:] = [d for d in dirs if d not in ignored_dirs]
            
            for file in sorted(files):
                if file in ignored_files:
                    continue
                
                # Check extension
                if not any(file.endswith(ext) for ext in valid_extensions):
                    continue
                
                file_path = os.path.join(root, file)
                
                # Create a clear separator for the LLM to read
                separator = f"\n{'='*80}\nFILE PATH: {file_path}\n{'='*80}\n"
                
                try:
                    with open(file_path, 'r', encoding='utf-8') as infile:
                        content = infile.read()
                        
                        outfile.write(separator)
                        outfile.write(content)
                        outfile.write("\n") # Ensure spacing between files
                        
                        print(f"  Added: {file_path}")
                        
                except Exception as e:
                    print(f"  ERROR reading {file_path}: {e}")

    print(f"\nSuccess! All code combined into: {output_filename}")

if __name__ == "__main__":
    combine_project_files()

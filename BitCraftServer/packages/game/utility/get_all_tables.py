import os, re

# Define the directory to search
directory = "../src"

# Define the list to store the table names
table_names = []

# Recursively search through each .rs file in the directory
for root, dirs, files in os.walk(directory):
    for file in files:
        if file.endswith(".rs"):
            # Open the file and iterate through each line
            with open(os.path.join(root, file), "r") as f:
                all_lines = f.readlines()
                for i, line in enumerate(all_lines):
                    # Check if the line contains #[spacetimedb(table)]
                    if "#[spacetimedb::table" in line:
                        #print("Found ",file,":",i)
                        # Continue checking lines until we find the table name
                        for j, j_line in enumerate(all_lines[i+1:]):
                            match = re.search(r'pub struct ([A-Za-z0-9_-]+) ',j_line)
                            if(match):
                                table_names.append(match.group(1))
                            if(j > 4):
                                break


# Print the list of table names
outstr = ""
for name in table_names:
    outstr = outstr + '"{}", '.format(name)
print(outstr)

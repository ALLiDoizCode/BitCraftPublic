import os, re
import chardet, shutil


edit_count = 0

# helpers

def to_pascal_case(snake_case_string):
    return ''.join(word.capitalize() for word in snake_case_string.split('_'))

def get_newline_type(file_path):
    with open(file_path, "rb") as file:
        raw_contents = file.read()

    newline_types = {"\r\n": "Windows (CRLF)", "\n": "Unix (LF)", "\r": "Mac (CR)"}
    for newline, newline_type in newline_types.items():
        if newline in raw_contents:
            return newline_type
    return "Unknown"

def check_if_file_starts_with_csharp_block_comment(file_path):
    try:
        with open(file_path, 'r') as file:
            first_line = file.readline()
            return first_line.startswith("/*")
    except FileNotFoundError:
        print(f"File {file_path} not found")
        return False

def read_file(file_path):
    with open(file_path, "rb") as file:
        result = chardet.detect(file.read())
        encoding = result["encoding"]
        
    with open(file_path, "r", encoding=encoding) as file:
        contents = file.read()
        newline_types = {"\r\n": "Windows (CRLF)", "\n": "Unix (LF)", "\r": "Mac (CR)"}
        for newline, newline_type_check in newline_types.items():
            if newline in contents:
                newline_type = newline
                break
    return contents, encoding, newline_type

def write_contents(contents,file_path,encoding,newline_type):
    if not(check_if_file_starts_with_csharp_block_comment(file_path)):
        with open(file_path, "w", encoding=encoding, newline=newline_type) as file:
            file.write(contents)
        pass

def replace_line(old_line,new_line,file_path):
    global edit_count

    contents, encoding, newline_type = read_file(file_path)
    print(f"Changing [{old_line}] to [{new_line}]")
    contents = contents.replace(old_line, new_line)

    edit_count = edit_count + 1
    write_contents(contents,file_path,encoding,newline_type)    

# first we need to build an association between the old tables and the types we generated that match them

def parse_file(file_path):
    gamestate_tables = {}
    custom_types = {}
    with open(file_path, 'r') as file:
        lines = file.readlines()
        for line in lines:
            match = re.search(r'public static readonly (LocationIndexedTable|BasicTable)<(\w+)> (\w+) =', line)
            if match:
                table_type = match.group(2)
                table_name = match.group(3)
                gamestate_tables[table_name] = table_type
            else:
                match = re.search(r'public static readonly (\w+) (\w+) =', line)
                if match:
                    table_type = match.group(1)
                    table_name = match.group(2)
                    gamestate_tables[table_name] = table_type
                    custom_types[table_type] = None
        for line in lines:
            for custom_type, value in custom_types.items():
                if value is None:
                    match = re.search(r'class {} : .*<(\w+)>'.format(custom_type), line)
                    if match:                        
                        base_type = match.group(1)
                        custom_types[custom_type] = base_type
        for table_name, table_type in gamestate_tables.items():
            if table_type in custom_types:
                gamestate_tables[table_name] = custom_types[table_type]
    return gamestate_tables

# then we go through every reference of GameState.*Table and update it to use the new table functions
# for Get we change to FilterByEntityId
# for TryGet (TBD)
# for OnUpdate, Delete, Insert, we point it to the new one and find the function and update the arguments

def find_table_type(root_dir, gamestate_tables):
    table_types = []
    callback_handlers = []
    key_replaces = []
    for dirpath, dirnames, filenames in os.walk(root_dir):
        for filename in filenames:
            if filename.endswith(".cs"):
                file_path = os.path.join(dirpath, filename)
                with open(file_path, 'r') as file:
                    handler_names = []
                    lines = file.readlines()
                    for line_number, line in enumerate(lines, 1):
                        for table_name, table_type in gamestate_tables.items():
                            if f"GameState.{table_name}." in line:
                                if "OnUpdate" in line or "OnInsert" in line or "OnDelete" in line:
                                    match = re.search("GameState\..+\.(.+) [-+]= (.+);",line)
                                    if(match):
                                        handler_names.append({'name':match.group(2),'callback_type':match.group(1),'table_type':table_type})
                                table_types.append({'file_path':file_path, 'line_number':line_number, 'table_name':table_name, 'table_type':table_type,'entire_line':line,'handler_names':handler_names})
                                #print(f"{file_path}:{line_number} - {table_name}, {table_type} ({line.strip()})")
                        for handler in handler_names:
                            function_name = handler['name']
                            callback_type = handler['callback_type']
                            table_type = handler['table_type']
                            if f"void {function_name}(" in line:
                                #print(f"Checking [{line}]")
                                callback_handler = {'file_path':file_path, 'line_number': line_number, 'function_name': function_name, 'callback_type':callback_type, 'table_type':table_type, 'entire_line':line}
                                if(handler['callback_type'] == "OnInsert" or handler['callback_type'] == "OnDelete"):
                                    #print(f"OnInsert line [{line}] {function_name}")
                                    match = re.search(rf"void {function_name} *\(.*, *.+ (.*),.*\)", line)
                                    if(match):
                                        callback_handler['param1_name'] = match.group(1)
                                    else:
                                        print(f"fail {line} {file_path}")
                                elif(handler['callback_type'] == "OnUpdate"):
                                    #print(f"OnUpdate line [{line}]")
                                    match = re.search(rf"void {function_name} *\(.*, *.+ (.*), *.+ (.*),.*\)", line)
                                    if(match):
                                        callback_handler['param1_name'] = match.group(1)
                                        callback_handler['param2_name'] = match.group(2)
                                    else:
                                        print(f"fail {line} {file_path}")

                                if('param1_name' in callback_handler and (callback_handler not in [handler for handler in callback_handlers if handler['line_number'] == callback_handler['line_number']])):
                                    #print(f"Adding [{line}]")
                                    callback_handlers.append(callback_handler)

                                    match = re.search("^([\s/]*){",lines[line_number])
                                    spacing = match.group(1)
                                    for function_line_number, function_line in enumerate(lines[line_number+1:]):
                                        if("key" in function_line):
                                            key_replaces.append({'file_path':file_path, 'param1_name':callback_handler['param1_name'], 'entire_line':function_line})
                                        elif(spacing+'}' in function_line):
                                            break                                    
                                else:
                                    pass
                                    #print(f"Skipping [{line}]")
                                #print(f"{file_path}:{line_number} - {function_name} ({line.strip()})")


    return table_types, callback_handlers, key_replaces

def do_smart_gamestate_replacements(table_types, callback_handlers, key_replaces):
    global edit_count

    for item in callback_handlers:
        file_path = item["file_path"]
        entire_line = item["entire_line"]
        line_number = item["line_number"]
        function_name = item["function_name"]
        callback_type = item["callback_type"]
        table_type = item["table_type"]
        param1_name = item["param1_name"]

        match = re.search(r"^([\s/]*)(?:private\s*)?(?:static\s*)?void", entire_line)
        static = ""
        if('static' in entire_line):
            static = 'static '

        before = ""
        if(match):
            before = match.group(1)
        else:
            print(f"Missing this one {entire_line}")

        if(callback_type == "OnUpdate"):
            param2_name = item["param2_name"]
            new_line = f"{before}private {static}void {function_name}({table_type} {param1_name}, {table_type} {param2_name})\n"
        elif(callback_type == "OnInsert" or callback_type == "OnDelete"):
            new_line = f"{before}private {static}void {function_name}({table_type} {param1_name})\n"

        replace_line(entire_line,new_line,file_path)

    for item in key_replaces:
        file_path = item["file_path"]
        entire_line = item["entire_line"]
        new_line = entire_line.replace('key',f'{param1_name}.EntityId')

        replace_line(entire_line,new_line,file_path)

    # go ahead and replace the rest of the GameState. references

    for dirpath, dirnames, filenames in os.walk('../../BitCraftClient/Assets/_Project/Scripts'):
        for filename in filenames:
            if filename.endswith(".cs"):
                file_path = os.path.join(dirpath, filename)
                old_contents, encoding, newline_type = read_file(file_path)
                contents = old_contents
                for table_name, table_type in gamestate_tables.items():                              
                    contents = contents.replace(f'GameState.{table_name}',table_type)

                if(contents != old_contents):
                    edit_count = edit_count + 1
                    print(f"Updating GameState references in {file_path}")  
                    write_contents(contents,file_path,encoding,newline_type)

def add_function_to_extension_file(file_path, class_name, function_code):
    global edit_count

    try:
        contents, encoding, newline_type = read_file(file_path)

        with open(file_path, 'r', encoding=encoding) as file:
            content = file.read()
            if not 'TryGet' in content and class_name in content:
                index = content.index(class_name)
                index = content[index+1:].index('{') + index + 2
                content = content[:index] + '\n' + function_code + '\n' + content[index:]                
                print(f"Function added to the class {class_name} in the file {file_path}")
            else:
                print(f"Skipped {file_path}")

        if content is not None:
            edit_count = edit_count + 1
            write_contents(content,file_path,encoding,newline_type)
    except FileNotFoundError:
        content = f"using Bitcraft;\n\nnamespace SpacetimeDB\n{{\n    public partial class {class_name}\n    {{\n{function_code}\n    }}\n}}\n"
        edit_count = edit_count + 1
        write_contents(content,file_path,"utf-8-sig",'\n')
        print(f"File {file_path} created and class {class_name} with the function added")

def add_gets():
    root_path = '../../BitCraftClient/Assets/_Project/Scripts/Lib/ProtobufExtensions'
    for table_name, table_type in gamestate_tables.items():
        file_path = os.path.join(root_path,table_type + ".cs")
        function_code = f"        public static {table_type} Get(ulong EntityId)\n        {{\n            return FilterByEntityId(EntityId);\n        }}\n\n"
        function_code = function_code + f"        public static bool TryGet(ulong EntityId, out {table_type} result)\n        {{\n            result = FilterByEntityId(EntityId);\n            return result != null;\n        }}"

        add_function_to_extension_file(file_path, table_type,function_code)


# now we need to fix the Get function for static data types

def parse_staticdata_tables(file_path):
    tables = []
    with open(file_path, 'r') as f:
        lines = f.readlines()
        for i, line in enumerate(lines):
            line = line.strip()
            match = re.search(r'message\s+(\w+)', line)
            if match and match.group(1) == "StaticData":
                start_index = i
                for member_line in lines[start_index+1:]:
                    member_line = member_line.strip()
                    member_match = re.search(r'(?:repeated\s+)?(\w+)\s+(\w+)\s*=\s*(\d+);', member_line)

                    if member_match:
                        tables.append(member_match.group(1))
                    elif "}" in member_line:
                        break
    return tables

def replace_static_data_gets(staticdata_table_names):
    global edit_count

    for dirpath, dirnames, filenames in os.walk('../../BitCraftClient/Assets/_Project/Scripts'):
        for filename in filenames:
            if filename.endswith(".cs"):
                file_path = os.path.join(dirpath, filename)
                contents, encoding, newline_type = read_file(file_path)
                wasChanged = False

                for static_data_type in staticdata_table_names:                         
                    start_index = 0
                    while(True):                        
                        old_text = rf'{static_data_type}\.Get\(([a-zA-Z0-9_ ]*?)\)'             
                        match = re.search(old_text,contents[start_index:])
                        if(match):
                            old_text = match.group(0)
                            new_text = f'{static_data_type}.FilterById({match.group(1)})'
                            start_index = contents[start_index:].index(old_text) + len(old_text) + 1
                            contents = contents.replace(old_text,new_text)
                            print(f"Changing [{old_text}] to [{new_text}]")
                            wasChanged = True
                            edit_count = edit_count + 1
                        else:
                            break

                for static_data_type in staticdata_table_names:                         
                    start_index = 0
                    while(True):                        
                        old_text = rf'{static_data_type}\.Enumerator'             
                        match = re.search(old_text,contents[start_index:])
                        if(match):
                            old_text = match.group(0)
                            new_text = f'{static_data_type}.Iter()'
                            start_index = contents[start_index:].index(old_text) + len(old_text) + 1
                            contents = contents.replace(old_text,new_text)
                            print(f"Changing [{old_text}] to [{new_text}]")
                            wasChanged = True
                            edit_count = edit_count + 1
                        else:
                            break

                if(wasChanged):                
                    write_contents(contents,file_path,encoding,newline_type)

# parse list of gamestate tables
gamestate_tables = parse_file("../../BitCraftClient_master/Assets/_Project/Scripts/GameSystems/GameState/GameState_Tables.cs")
# find all references to gamestate tables that we know how to replace
table_types, callback_handlers, key_replaces = find_table_type('../../BitCraftClient/Assets/_Project/Scripts', gamestate_tables)
# replace all references to gamestate.TABLE_NAME in code
print("--- REPLACING GAMESTATE REFERENCES")
do_smart_gamestate_replacements(table_types, callback_handlers, key_replaces)
# add try_gets to extension files
print("--- ADD TRYGET TO EXTENSIONS")
#add_gets()


print(f"TOTAL EDITS: {edit_count}")
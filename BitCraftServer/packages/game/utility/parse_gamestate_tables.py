import os
import re

protobuf_to_rust_types = {
        'int32': 'i32',
        'uint32': 'u32',
        'int64': 'i64',
        'uint64': 'u64',
        'float': 'f32',
        'double': 'f64',
        'string': 'String',
        'bool': 'bool',
        'bytes': 'Vec<u8>'
    }

# Build list of tables based on GameState tables 
def parse_gamestate_tables(file_path):
    tables = []
    with open(file_path, 'r') as f:
        lines = f.readlines()
        for i, line in enumerate(lines):
            if 'operations' in line:
                # Check the next line for the table definition
                if(len(lines) > i+1):
                    table_def = lines[i+1]
                    match = re.search(r'pub\s(\w+):\sTransactionalComponentTable<(\w+)>', table_def)
                    if not(match):
                        match = re.search(r'pub\s(\w+):\sTransactionalComponentIndexedTable<.+, (\w+)>', table_def)
                        
                    if match and match.group(2) != 'TimerState' and match.group(2) != 'TimerEventState':
                        table_name = match.group(1)
                        table_type = match.group(2)
                        tables.append(table_type)
    return tables

#gamestate_table_names = parse_gamestate_tables("../packages/game/bitcraft/src/game/game_state/mod.rs")
gamestate_table_names = parse_gamestate_tables("../../Bitcraft/packages/game/bitcraft/src/game/game_state/mod.rs")

print("GameState tables: ")
print(gamestate_table_names)

# Build list of tables based on StaticData message

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
                        print(member_match.group(1))
                        tables.append(member_match.group(1))
                    elif "}" in member_line:
                        break
    return tables

staticdata_table_names = parse_staticdata_tables("../../Bitcraft/packages/game/bitcraft/protobuf/StaticData.proto")

print("Static Data tables:")
print(staticdata_table_names)

# Build list of tuples used for reducers

def parse_actionrequest_tuples(file_path):
    tuples = []
    with open(file_path, 'r') as f:
        lines = f.readlines()
        for i, line in enumerate(lines):
            line = line.strip()
            match = re.search(r'message\s+(\w+)', line)
            if match and match.group(1) == "ActionRequest":                
                start_index = i
                line_index = start_index
                for member_line in lines[start_index+1:]:
                    line_index = line_index + 1
                    if "oneof" in member_line:                        
                        for union_line in lines[line_index+1:]:
                            union_match = re.search(r'(\w+)\s+(\w+)\s*=\s*(\d+);', union_line)
                            if(union_match):
                                tuples.append(union_match.group(1))
                            elif "}" in union_line:
                                break
    return tuples                            


actionrequest_tuple_names = parse_actionrequest_tuples("../../Bitcraft/packages/game/bitcraft/protobuf/ActionRequest.proto")

print("Action request tuples:")
print(actionrequest_tuple_names)

# Build a list of all enum names to be used as custom types

dir_path = "../../Bitcraft/packages/game/bitcraft/protobuf"

def parse_enums(dir_path):
    enum_names = {}
    for file_name in os.listdir(dir_path):
        if file_name.endswith(".proto"):
            with open(os.path.join(dir_path, file_name), 'r') as f:
                lines = f.readlines()
                line_index = 0
                message = None
                for i, line in enumerate(lines):
                    line_index = line_index + 1
                    line = line.strip()
                    if line.startswith("message"):
                        message = line.split()[1]
                    if line.startswith("enum"):
                        enum_name = line.split()[1]
                        enum_names[enum_name] = message
    return enum_names

enum_names = parse_enums(dir_path)

# Parse members for all tables, enums and tuples

def parse_proto_files_members(dir_path, custom_types):
    tuples = []
    new_enums = []
    new_custom_types = []
    current_enum = None

    for file_name in os.listdir(dir_path):
        if file_name.endswith(".proto"):
            with open(os.path.join(dir_path, file_name), 'r') as f:
                lines = f.readlines()
                for i, line in enumerate(lines):
                    line = line.strip()
                    match = re.search(r'message\s+(\w+)', line)
                    if match and match.group(1) in custom_types:
                        current_tuple = {'name': match.group(1), 'file_name': file_name, 'members': []}
                        tuples.append(current_tuple)
                        start_index = i
                        skip_lines = 0
                        line_index = start_index+1
                        for member_line in lines[start_index+1:]:
                            line_index = line_index + 1
                            member_line = member_line.strip()
                            if member_line.startswith("enum"):
                                enum_name = member_line.split()[1]
                                current_enum = {'name': enum_name, 'message': current_tuple['name'], 'file_name': file_name, 'values': []}
                                new_enums.append(current_enum)
                                for enum_line in lines[line_index:]:
                                    enum_line = enum_line.strip()
                                    skip_lines = skip_lines + 1
                                    if "}" in enum_line:
                                        break
                                    else:
                                        # capitalize first letter
                                        enum_value_name = enum_line.split("=")[0].strip()
                                        enum_value_name = enum_value_name[:1].upper() + enum_value_name[1:]
                                        current_enum['values'].append(enum_value_name)
                            elif skip_lines > 0:
                                skip_lines = skip_lines - 1
                            else:
                                custom_type = None
                                member_match = re.search(r'(\w+)\s+(\w+)\s*=\s*(\d+);', member_line)
                                member_type_match = re.search(r'repeated\s+(\w+)', member_line)
                                if(member_type_match):
                                    member_match = re.search(r'(\w+)\s+(\w+)\s+(\w+)\s*=\s*(\d+);', member_line)
                                if member_match:
                                    member = {'name': member_match.group(2)}
                                    member_type = member_match.group(1)
                                    if member_type in protobuf_to_rust_types:
                                        member_type = protobuf_to_rust_types[member_type]
                                    # NOTE: remove this to generate enums, you'll also need to rename Type (see above)                                    
                                    elif member_type in enum_names:
                                        member_type = "i32";
                                    elif member_type == "repeated":
                                        member['name'] = member_match.group(3)
                                        member_type = member_match.group(2)
                                        if member_type in protobuf_to_rust_types:
                                            member_type = protobuf_to_rust_types[member_type]
                                        # NOTE: remove this to generate enums, you'll also need to rename Type (see above)                                        
                                        elif member_type in enum_names:
                                            member_type = "i32"
                                        else:
                                            custom_type = member_type
                                        member_type = 'Vec<{}>'.format(member_type)
                                    else:
                                        custom_type = member_type

                                    member['type'] = member_type
                                    member['name'] = re.sub(r'(?<!^)(?=[A-Z])', '_', member['name']).lower()
                                    if(member['name'] == "type"):
                                        member['name'] = "r#type"
                                    elif(member['name'] == "entity_id"):
                                        member['name'] = "owner_entity_id"   

                                    current_tuple['members'].append(member)

                                    if(custom_type and custom_type not in new_custom_types):
                                        new_custom_types.append(custom_type)
                                elif "}" in member_line:
                                    break
    return tuples, new_enums, new_custom_types                                    

tuples = []
enums = []

custom_types = []
custom_types.extend(gamestate_table_names)
custom_types.extend(staticdata_table_names)
custom_types.extend(actionrequest_tuple_names)
custom_types.append("WorldGenWorldDefinition")
found = True
while found:
    new_tuples, new_enums, custom_types = parse_proto_files_members(dir_path, custom_types)
    for new_tuple in new_tuples:
        if not(new_tuple in tuples):            
            tuples.append(new_tuple)
    for new_enum in new_enums:
        if not(new_enum in enums):
            enums.append(new_enum)
    found = len(custom_types) > 0

print("Tuples: ")
print([tuple_info['name'] for tuple_info in tuples])
print("Enums: ")
print([enum_info['name'] for enum_info in enums])

# Build list of files from tables, tuples

file_names = []
for tuple_item in tuples:
    if(tuple_item['file_name'] not in file_names):
        file_names.append(tuple_item['file_name'])

# For each file, build rust file

file_use_statements = {
    'static_data.rs': 'use crate::components::game_util::{\nBuildingRequirement, CargoItemStack, ExperienceStack, InputItemStack, ItemStack,\nLevelRequirement, ProbabilisticItemStack, ToolRequirement,\n};',
    'action_request.rs': 'use crate::components::components::{BuildingState, DimensionDescription, EnemyState, NpcState, ResourceDeposit};\nuse crate::components::game_util::ItemStack;\nuse crate::components::spawnable_entity::SpawnableEntity;\nuse crate::components::static_data::StatEntry;\nuse crate::components::util::{HexCoordinatesMessage, OffsetCoordinatesFloat};',
    'quest.rs': 'use crate::components::game_util::{ExperienceStack, ItemStack};\n\nuse crate::components::util::PlatformText;',
    'components.rs': 'use crate::components::game_util::{BuffState, ExperienceStack, ItemStack, TradePocket, Pocket};\nuse crate::components::quest::Quest;\nuse crate::components::static_data::EquipmentSlot;\nuse crate::components::util::HexCoordinatesMessage;',
    'spawnable_entity.rs': 'use crate::components::components::*;'
}

def generate_rust_file(file_path, gamestate_table_names, staticdata_table_names, tuples, enums):
    with open(file_path, 'w') as f:
        f.write("use spacetimedb::spacetimedb;\n\n")

        for file_item in file_use_statements.items():
            if(file_path.endswith(file_item[0])):
                f.write(file_item[1] + "\n\n")
                break;

        for enum in enums:
            mod_name = re.sub(r'(?<!^)(?=[A-Z])', '_', enum['message']).lower()
            f.write("pub mod {} {{\n".format(mod_name))
            f.write("    pub enum {} {{\n".format(enum['name']))
            for value in enum['values']:
                f.write("        {},\n".format(value))
            f.write("    }\n}\n\n")
        for tuple_info in tuples:
            is_gamestate_table = tuple_info['name'] in gamestate_table_names
            is_table = is_gamestate_table or tuple_info['name'] in staticdata_table_names
            if(is_table):
                f.write("#[spacetimedb::table)]\n")
            else:
                f.write("#[spacetimedb::tuple)]\n")

            f.write("pub struct {} {{\n".format(tuple_info['name']))
            if(is_gamestate_table):
                f.write("    #[primarykey]\n    pub entity_id: u64,\n\n")
            for member in tuple_info['members']:
                if 'values' in member:
                    for value in member['values']:
                        f.write("    pub {}: {} = {},\n".format(value["name"], member["name"], value["value"]))
                else:
                    f.write("    pub {}: {},\n".format(member['name'], member['type']))
            f.write("}\n\n")

    print("Rust file created: {}".format(file_path))

print("Files to generated: ")
print(file_names)
root_path = "../src/components"
for file_name in file_names:
    file_enums = [enum_item for enum_item in enums if enum_item['file_name'] == file_name]
    file_tuples = [tuple_item for tuple_item in tuples if tuple_item['file_name'] == file_name]
    rust_file_name = re.sub(r'(?<!^)(?=[A-Z])', '_', file_name)
    rust_file_name = rust_file_name.replace(".proto", ".rs").lower()
    generate_rust_file(os.path.join(root_path,rust_file_name), gamestate_table_names, staticdata_table_names, file_tuples, file_enums)

# build a csharp enum file for the client to use until we get enum support

def generate_client_enum_file(file_path, enums):
    with open(file_path, 'w') as f:
        f.write("namespace Bitcraft\n{\n")
        for enum in enums:
            f.write("    public partial class {} {{\n        public class Types {{\n".format(enum['message']))
            f.write("            public enum {} {{\n".format(enum['name']))
            for value in enum['values']:
                f.write("                {},\n".format(value))
            f.write("            }\n\n")
            f.write("        }\n\n")
            f.write("    }\n\n")
        f.write("}")

    print("Client enum file created: {}".format(file_path))

generate_client_enum_file('../../BitcraftClient/Assets/_Project/autogen/Enums.cs',enums)
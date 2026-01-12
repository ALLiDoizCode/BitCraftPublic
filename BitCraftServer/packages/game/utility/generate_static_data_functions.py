import os

output = ""
for file_name in os.listdir('../../BitCraftClient/Assets/_Project/StaticData'):
    if file_name.endswith(".csv"):
        data_name = file_name[:-4]
        output = output + "Reducer.Load" + data_name + "s(ReadString(\""+file_name+"\"));" + "\n"

print(output)
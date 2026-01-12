import os
import re


dir_path = "../../BitCraftClient/Assets/_Project/Scripts/GameSystems/Animations/PlayerAnimations"

def comment_all_handlers(dir_path,conditionStr):
    enum_names = []
    for file_name in os.listdir(dir_path):
        if file_name.endswith(".cs"):
            with open(os.path.join(dir_path,file_name), "r") as file:
                file_contents = file.read()

            if(not file_contents.startswith("/*") and conditionStr is not None and conditionStr in file_contents):
                file_contents = '/*\n' + file_contents + '\n*/'

                with open(os.path.join(dir_path,file_name), "w") as file:
                    file.write(file_contents)
                    print("Block commenting " + file_name)
            else:
                print("Skipping " + file_name)


comment_all_handlers("../../BitcraftClient/Assets/_Project/Scripts/GameSystems/StateRendering/TransactionHandlers",None)
comment_all_handlers("../../BitCraftClient/Assets/_Project/Scripts/GameSystems/Animations/PlayerAnimations",": IPlayerActionAnimator")


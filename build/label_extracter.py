import json

# Replace 'language.json' with the path to your JSON file
input_file = 'portuguese_BR.json'
output_file = 'pt_BR_labels.txt'

with open(input_file, 'r', encoding='utf-8') as f:
    data = json.load(f)

# Assuming data is a list of species objects
with open(output_file, 'w', encoding='utf-8') as f:
    for species in data:
        sci_name = species.get('sciName', '')
        com_name = species.get('comName', '')
        if sci_name and com_name:
            f.write(f"{sci_name}_{com_name}\n")

print(f"Data extracted to {output_file}")

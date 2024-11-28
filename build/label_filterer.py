# Define file paths
pt_labels_file = 'pt_BR_labels.txt'
birdnet_labels_file = 'BirdNET_GLOBAL_6K_V2.4_Labels_en.txt'
final_output_file = 'final_pt_labels.txt'

# Read BirdNET_GLOBAL labels and extract sciNames (sname and cname)
with open(birdnet_labels_file, 'r', encoding='utf-8') as f:
    birdnet_labels = {line.strip() for line in f if '_' in line}
    birdnet_snames = {line.split('_')[0].strip() for line in birdnet_labels}

# Read pt_labels and extract sciNames (sname and cname)
with open(pt_labels_file, 'r', encoding='utf-8') as f:
    pt_labels = {line.strip() for line in f}
    pt_snames = {line.split('_')[0] for line in pt_labels}

# Filter labels present in both files
filtered_labels = [
    label for label in pt_labels if label.split('_')[0] in birdnet_snames
]

# Add labels from BirdNET file that are not in pt_labels
missing_labels = [
    label for label in birdnet_labels if label.split('_')[0] not in pt_snames
]

# Capitalise the first letter of every word in the common name (cname)
def capitalize_cname(label):
    sci_name, com_name = label.split('_')
    com_name = com_name.title()  # Capitalise the first letter of every word in the common name
    return f"{sci_name}_{com_name}"

# Capitalise the common names in the filtered and missing labels
filtered_labels = [capitalize_cname(label) for label in filtered_labels]
missing_labels = [capitalize_cname(label) for label in missing_labels]

# Combine and sort all labels alphabetically by sciName
all_labels = sorted(filtered_labels + missing_labels, key=lambda x: x.split('_')[0])

# Write the sorted labels to the final output file
with open(final_output_file, 'w', encoding='utf-8') as f:
    for label in all_labels:
        f.write(f"{label}\n")

print(f"Filtered, merged, and sorted labels written to {final_output_file}")

//const tf = require('@tensorflow/tfjs');

importScripts('../node_modules/@tensorflow/tfjs/dist/tf.min.js');

//tf.ENV.set('WEBGL_FORCE_F16_TEXTURES', true)
tf.enableProdMode();
// Removed this to re-enable all webgl features
//tf.ENV.set('WEBGL_PACK', false)

//console.log(tf.env().features);

// https://www.tensorflow.org/js/guide/platform_environment#flags
//tf.enableDebugMode()
let labels;
let old_labels = ["Tachymarptis melba_Alpine Swift", "Ambient Noise_Ambient Noise", "Pluvialis dominica_American Golden Plover", "Mareca americana_American Wigeon", "Animal_Animal", "Acrocephalus paludicola_Aquatic Warbler", "Acanthis hornemanni_Arctic Redpoll", "Stercorarius parasiticus_Arctic Skua", "Sterna paradisaea_Arctic Tern", "Phylloscopus borealis_Arctic Warbler", "Recurvirostra avosetta_Avocet", "Porzana pusilla_Baillon's Crake", "Limosa lapponica_Bar-tailed Godwit", "Tyto alba_Barn Owl", "Branta leucopsis_Barnacle Goose", "Sylvia nisoria_Barred Warbler", "Panurus biarmicus_Bearded Tit", "Merops apiaster_Bee-eater", "Cygnus columbianus_Bewick's Swan", "Botaurus stellaris_Bittern", "Oenanthe hispanica_Black-eared Wheatear", "Chroicocephalus ridibundus_Black-headed Gull", "Podiceps nigricollis_Black-necked Grebe", "Limosa limosa_Black-tailed Godwit", "Himantopus himantopus_Black-winged Stilt", "Lyrurus tetrix_Black Grouse", "Cepphus grylle_Black Guillemot", "Milvus migrans_Black Kite", "Phoenicurus ochruros_Black Redstart", "Chlidonias niger_Black Tern", "Turdus merula_Blackbird", "Sylvia atricapilla_Blackcap", "Spatula discors_Blue-winged Teal", "Cyanistes caeruleus_Blue Tit", "Luscinia svecica_Bluethroat", "Acrocephalus dumetorum_Blyth's Reed Warbler", "Fringilla montifringilla_Brambling", "Branta bernicla_Brent Goose", "Pyrrhula pyrrhula_Bullfinch", "Buteo buteo_Buzzard", "Branta canadensis_Canada Goose", "Tetrao urogallus_Capercaillie", "Corvus corone_Crow", "Larus cachinnans_Caspian Gull", "Bubulcus ibis_Cattle Egret", "Cettia cetti_Cetti's Warbler", "Fringilla coelebs_Chaffinch", "Phylloscopus collybita_Chiffchaff", "Pyrrhocorax pyrrhocorax_Chough", "Emberiza cirlus_Cirl Bunting", "Motacilla citreola_Citrine Wagtail", "Periparus ater_Coal Tit", "Streptopelia decaocto_Collared Dove", "Glareola pratincola_Collared Pratincole", "Loxia curvirostra_Common Crossbill", "Larus canus_Common Gull", "Acanthis flammea_Common Redpoll", "Carpodacus erythrinus_Common Rosefinch", "Actitis hypoleucos_Common Sandpiper", "Melanitta nigra_Common Scoter", "Sterna hirundo_Common Tern", "Fulica atra_Coot", "Phalacrocorax carbo_Cormorant", "Emberiza calandra_Corn Bunting", "Crex crex_Corncrake", "Calonectris borealis_Cory's Shearwater", "Grus grus_Crane", "Lophophanes cristatus_Crested Tit", "Cuculus canorus_Cuckoo", "Calidris ferruginea_Curlew Sandpiper", "Numenius arquata_Curlew", "Sylvia undata_Dartford Warbler", "Cinclus cinclus_Dipper", "Charadrius morinellus_Dotterel", "Calidris alpina_Dunlin", "Prunella modularis_Dunnock", "Phylloscopus fuscatus_Dusky Warbler", "Alopochen aegyptiaca_Egyptian Goose", "Somateria mollissima_Eider", "Bubo bubo_Eurasian Eagle-Owl", "Turdus pilaris_Fieldfare", "Regulus ignicapilla_Firecrest", "Fulmarus glacialis_Fulmar", "Mareca strepera_Gadwall", "Morus bassanus_Gannet", "Sylvia borin_Garden Warbler", "Spatula querquedula_Garganey", "Larus hyperboreus_Glaucous Gull", "Plegadis falcinellus_Glossy Ibis", "Regulus regulus_Goldcrest", "Aquila chrysaetos_Golden Eagle", "Oriolus oriolus_Golden Oriole", "Pluvialis apricaria_Golden Plover", "Bucephala clangula_Goldeneye", "Carduelis carduelis_Goldfinch", "Mergus merganser_Goosander", "Accipiter gentilis_Goshawk", "Locustella naevia_Grasshopper Warbler", "Larus marinus_Great Black-backed Gull", "Podiceps cristatus_Great Crested Grebe", "Lanius excubitor_Great Grey Shrike", "Gavia immer_Great Northern Diver", "Stercorarius skua_Great Skua", "Dendrocopos major_Great Spotted Woodpecker", "Parus major_Great Tit", "Ardea alba_Great White Egret", "Anas carolinensis_Green-winged Teal", "Tringa ochropus_Green Sandpiper", "Picus viridis_Green Woodpecker", "Chloris chloris_Greenfinch", "Phylloscopus trochiloides_Greenish Warbler", "Tringa nebularia_Greenshank", "Ardea cinerea_Grey Heron", "Perdix perdix_Grey Partridge", "Phalaropus fulicarius_Grey Phalarope", "Pluvialis squatarola_Grey Plover", "Motacilla cinerea_Grey Wagtail", "Anser anser_Greylag Goose", "Uria aalge_Guillemot", "Gelochelidon nilotica_Gull-billed Tern", "Coccothraustes coccothraustes_Hawfinch", "Larus argentatus_Herring Gull", "Falco subbuteo_Hobby", "Pernis apivorus_Honey-buzzard", "Upupa epops_Hoopoe", "Delichon urbicum_House Martin", "Passer domesticus_House Sparrow", "Human_Human", "Phylloscopus ibericus_Iberian Chiffchaff", "Hippolais icterina_Icterine Warbler", "Lymnocryptes minimus_Jack Snipe", "Coloeus monedula_Jackdaw", "Garrulus glandarius_Jay", "Charadrius alexandrinus_Kentish Plover", "Falco tinnunculus_Kestrel", "Alcedo atthis_Kingfisher", "Rissa tridactyla_Kittiwake", "Calidris canutus_Knot", "Calcarius lapponicus_Lapland Bunting", "Vanellus vanellus_Lapwing", "Larus fuscus_Lesser Black-backed Gull", "Acanthis cabaret_Lesser Redpoll", "Dryobates minor_Lesser Spotted Woodpecker", "Sylvia curruca_Lesser Whitethroat", "Linaria cannabina_Linnet", "Ixobrychus minutus_Little Bittern", "Emberiza pusilla_Little Bunting", "Egretta garzetta_Little Egret", "Tachybaptus ruficollis_Little Grebe", "Hydrocoloeus minutus_Little Gull", "Athene noctua_Little Owl", "Charadrius dubius_Little Ringed Plover", "Calidris minuta_Little Stint", "Sternula albifrons_Little Tern", "Asio otus_Long-eared Owl", "Clangula hyemalis_Long-tailed Duck", "Stercorarius longicaudus_Long-tailed Skua", "Aegithalos caudatus_Long-tailed Tit", "Pica pica_Magpie", "Anas platyrhynchos_Mallard", "Aix galericulata_Mandarin Duck", "Puffinus puffinus_Manx Shearwater", "Circus aeruginosus_Marsh Harrier", "Poecile palustris_Marsh Tit", "Anthus pratensis_Meadow Pipit", "Ichthyaetus melanocephalus_Mediterranean Gull", "Hippolais polyglotta_Melodious Warbler", "Falco columbarius_Merlin", "Turdus viscivorus_Mistle Thrush", "Circus pygargus_Montagu's Harrier", "Gallinula chloropus_Moorhen", "Cygnus olor_Mute Swan", "Nycticorax nycticorax_Night Heron", "Luscinia megarhynchos_Nightingale", "Caprimulgus europaeus_Nightjar", "Sitta europaea_Nuthatch", "Anthus hodgsoni_Olive-backed Pipit", "Emberiza hortulana_Ortolan Bunting", "Pandion haliaetus_Osprey", "Haematopus ostralegus_Oystercatcher", "Syrrhaptes paradoxus_Pallas's Sandgrouse", "Phylloscopus proregulus_Pallas's Warbler", "Loxia pytyopsittacus_Parrot Crossbill", "Calidris melanotos_Pectoral Sandpiper", "Remiz pendulinus_Penduline Tit", "Falco peregrinus_Peregrine", "Phasianus colchicus_Pheasant", "Ficedula hypoleuca_Pied Flycatcher", "Motacilla alba_Pied Wagtail", "Anser brachyrhynchus_Pink-footed Goose", "Anas acuta_Pintail", "Aythya ferina_Pochard", "Lagopus muta_Ptarmigan", "Ardea purpurea_Purple Heron", "Calidris maritima_Purple Sandpiper", "Coturnix coturnix_Quail", "Phylloscopus schwarzi_Radde's Warbler", "Corvus corax_Raven", "Alca torda_Razorbill", "Lanius collurio_Red-backed Shrike", "Ficedula parva_Red-breasted Flycatcher", "Mergus serrator_Red-breasted Merganser", "Netta rufina_Red-crested Pochard", "Tarsiger cyanurus_Red-flanked Bluetail", "Alectoris rufa_Red-legged Partridge", "Podiceps grisegena_Red-necked Grebe", "Caprimulgus ruficollis_Red-necked Nightjar", "Phalaropus lobatus_Red-necked Phalarope", "Cecropis daurica_Red-rumped Swallow", "Gavia stellata_Red-throated Diver", "Lagopus lagopus_Red Grouse", "Milvus milvus_Red Kite", "Tringa totanus_Redshank", "Phoenicurus phoenicurus_Redstart", "Turdus iliacus_Redwing", "Emberiza schoeniclus_Reed Bunting", "Acrocephalus scirpaceus_Reed Warbler", "Anthus richardi_Richard's Pipit", "Larus delawarensis_Ring-billed Gull", "Psittacula krameri_Ring-necked Parakeet", "Turdus torquatus_Ring Ouzel", "Charadrius hiaticula_Ringed Plover", "Erithacus rubecula_Robin", "Columba livia_Rock Dove", "Anthus petrosus_Rock Pipit", "Corvus frugilegus_Rook", "Pastor roseus_Rose-coloured Starling", "Sterna dougallii_Roseate Tern", "Buteo lagopus_Rough-legged Buzzard", "Oxyura jamaicensis_Ruddy Duck", "Tadorna ferruginea_Ruddy Shelduck", "Calidris pugnax_Ruff", "Xema sabini_Sabine's Gull", "Riparia riparia_Sand Martin", "Calidris alba_Sanderling", "Thalasseus sandvicensis_Sandwich Tern", "Locustella luscinioides_Savi's Warbler", "Aythya marila_Scaup", "Loxia scotica_Scottish Crossbill", "Acrocephalus schoenobaenus_Sedge Warbler", "Calidris pusilla_Semipalmated Sandpiper", "Serinus serinus_Serin", "Tadorna tadorna_Shelduck", "Eremophila alpestris_Shore Lark", "Asio flammeus_Short-eared Owl", "Calandrella brachydactyla_Short-toed Lark", "Spatula clypeata_Shoveler", "Spinus spinus_Siskin", "Alauda arvensis_Skylark", "Podiceps auritus_Slavonian Grebe", "Gallinago gallinago_Snipe", "Plectrophenax nivalis_Snow Bunting", "Anser caerulescens_Snow Goose", "Turdus philomelos_Song Thrush", "Accipiter nisus_Sparrowhawk", "Platalea leucorodia_Spoonbill", "Porzana porzana_Spotted Crake", "Muscicapa striata_Spotted Flycatcher", "Tringa erythropus_Spotted Redshank", "Actitis macularius_Spotted Sandpiper", "Sturnus vulgaris_Starling", "Columba oenas_Stock Dove", "Burhinus oedicnemus_Stone-curlew", "Saxicola rubicola_Stonechat", "Hydrobates pelagicus_Storm Petrel", "Sylvia cantillans_Subalpine Warbler", "Hirundo rustica_Swallow", "Apus apus_Swift", "Anser fabalis_Taiga Bean Goose", "Strix aluco_Tawny Owl", "Anas crecca_Teal", "Calidris temminckii_Temminck's Stint", "Anthus trivialis_Tree Pipit", "Passer montanus_Tree Sparrow", "Certhia familiaris_Treecreeper", "Aythya fuligula_Tufted Duck", "Anser serrirostris_Tundra Bean Goose", "Arenaria interpres_Turnstone", "Streptopelia turtur_Turtle Dove", "Linaria flavirostris_Twite", "Loxia leucoptera_Two-barred Crossbill", "Vehicle_Vehicle", "Anthus spinoletta_Water Pipit", "Rallus aquaticus_Water Rail", "Bombycilla garrulus_Waxwing", "Oenanthe oenanthe_Wheatear", "Numenius phaeopus_Whimbrel", "Saxicola rubetra_Whinchat", "Anser albifrons_White-fronted Goose", "Calidris fuscicollis_White-rumped Sandpiper", "Haliaeetus albicilla_White-tailed Eagle", "Chlidonias leucopterus_White-winged Black Tern", "Ciconia ciconia_White Stork", "Sylvia communis_Whitethroat", "Cygnus cygnus_Whooper Swan", "Mareca penelope_Wigeon", "Poecile montanus_Willow Tit", "Phylloscopus trochilus_Willow Warbler", "Tringa glareola_Wood Sandpiper", "Phylloscopus sibilatrix_Wood Warbler", "Scolopax rusticola_Woodcock", "Lullula arborea_Woodlark", "Columba palumbus_Woodpigeon", "Troglodytes troglodytes_Wren", "Jynx torquilla_Wryneck", "Phylloscopus inornatus_Yellow-browed Warbler", "Larus michahellis_Yellow-legged Gull", "Motacilla flava_Yellow Wagtail", "Emberiza citrinella_Yellowhammer"];
let new_labels = ["Tachymarptis melba_Alpine Swift (call)", "Ambient Noise_Ambient Noise", "Pluvialis dominica_American Golden Plover (call)", "Mareca americana_American Wigeon (call)", "Animal_Animal", "Acrocephalus paludicola_Aquatic Warbler (song)", "Acanthis hornemanni_Arctic Redpoll (call)", "Acanthis hornemanni_Arctic Redpoll (song)", "Stercorarius parasiticus_Arctic Skua (call)", "Sterna paradisaea_Arctic Tern (call)", "Phylloscopus borealis_Arctic Warbler (call)", "Phylloscopus borealis_Arctic Warbler (song)", "Recurvirostra avosetta_Avocet (call)", "Porzana pusilla_Baillon’s Crake (call)", "Porzana pusilla_Baillon’s Crake (song)", "Limosa lapponica_Bar-tailed Godwit (call)", "Tyto alba_Barn Owl (call)", "Tyto alba_Barn Owl (song)", "Branta leucopsis_Barnacle Goose (call)", "Sylvia nisoria_Barred Warbler (call)", "Sylvia nisoria_Barred Warbler (song)", "Panurus biarmicus_Bearded Tit (call)", "Merops apiaster_Bee-eater (call)", "Merops apiaster_Bee-eater (song)", "Cygnus columbianus_Bewick's Swan (call)", "Botaurus stellaris_Bittern (call)", "Botaurus stellaris_Bittern (song)", "Oenanthe hispanica_Black-eared Wheatear (song)", "Chroicocephalus ridibundus_Black-headed Gull (call)", "Podiceps nigricollis_Black-necked Grebe (call)", "Limosa limosa_Black-tailed Godwit (call)", "Limosa limosa_Black-tailed Godwit (song)", "Himantopus himantopus_Black-winged Stilt (call)", "Lyrurus tetrix_Black Grouse (call)", "Lyrurus tetrix_Black Grouse (song)", "Cepphus grylle_Black Guillemot (call)", "Milvus migrans_Black Kite (call)", "Phoenicurus ochruros_Black Redstart (call)", "Phoenicurus ochruros_Black Redstart (song)", "Chlidonias niger_Black Tern (call)", "Turdus merula_Blackbird (call)", "Turdus merula_Blackbird (flight call)", "Turdus merula_Blackbird (song)", "Sylvia atricapilla_Blackcap (call)", "Sylvia atricapilla_Blackcap (song)", "Spatula discors_Blue-winged Teal (call)", "Cyanistes caeruleus_Blue Tit (call)", "Cyanistes caeruleus_Blue Tit (song)", "Luscinia svecica_Bluethroat (call)", "Luscinia svecica_Bluethroat (song)", "Acrocephalus dumetorum_Blyth’s Reed Warbler (call)", "Acrocephalus dumetorum_Blyth’s Reed Warbler (song)", "Fringilla montifringilla_Brambling (call)", "Fringilla montifringilla_Brambling (song)", "Branta bernicla_Brent Goose (call)", "Pyrrhula pyrrhula_Bullfinch (call)", "Pyrrhula pyrrhula_Bullfinch (song)", "Buteo buteo_Buzzard (call)", "Branta canadensis_Canada Goose (call)", "Tetrao urogallus_Capercaillie (call)", "Tetrao urogallus_Capercaillie (song)", "Corvus corone_Carrion Crow (call)", "Larus cachinnans_Caspian Gull (call)", "Bubulcus ibis_Cattle Egret (call)", "Cettia cetti_Cetti’s Warbler (call)", "Cettia cetti_Cetti’s Warbler (song)", "Fringilla coelebs_Chaffinch (call)", "Fringilla coelebs_Chaffinch (song)", "Phylloscopus collybita_Chiffchaff (call)", "Phylloscopus collybita_Chiffchaff (song)", "Pyrrhocorax pyrrhocorax_Chough (call)", "Emberiza cirlus_Cirl Bunting (call)", "Emberiza cirlus_Cirl Bunting (song)", "Motacilla citreola_Citrine Wagtail (call)", "Motacilla citreola_Citrine Wagtail (song)", "Periparus ater_Coal Tit (call)", "Periparus ater_Coal Tit (song)", "Streptopelia decaocto_Collared Dove (call)", "Streptopelia decaocto_Collared Dove (song)", "Glareola pratincola_Collared Pratincole (call)", "Loxia curvirostra_Common Crossbill (call)", "Loxia curvirostra_Common Crossbill (song)", "Larus canus_Common Gull (call)", "Larus canus_Common Gull (song)", "Acanthis flammea_Common Redpoll (call)", "Acanthis flammea_Common Redpoll (song)", "Carpodacus erythrinus_Common Rosefinch (call)", "Carpodacus erythrinus_Common Rosefinch (song)", "Actitis hypoleucos_Common Sandpiper (call)", "Actitis hypoleucos_Common Sandpiper (song)", "Melanitta nigra_Common Scoter (call)", "Sterna hirundo_Common Tern (call)", "Fulica atra_Coot (call)", "Phalacrocorax carbo_Cormorant (call)", "Emberiza calandra_Corn Bunting (call)", "Emberiza calandra_Corn Bunting (song)", "Crex crex_Corncrake (call)", "Crex crex_Corncrake (song)", "Calonectris borealis_Cory’s Shearwater (call)", "Grus grus_Crane (call)", "Grus grus_Crane (song)", "Lophophanes cristatus_Crested Tit (call)", "Lophophanes cristatus_Crested Tit (song)", "Cuculus canorus_Cuckoo (call)", "Cuculus canorus_Cuckoo (song)", "Calidris ferruginea_Curlew Sandpiper (call)", "Numenius arquata_Curlew (call)", "Numenius arquata_Curlew (song)", "Sylvia undata_Dartford Warbler (call)", "Sylvia undata_Dartford Warbler (song)", "Cinclus cinclus_Dipper (call)", "Cinclus cinclus_Dipper (song)", "Charadrius morinellus_Dotterel (call)", "Charadrius morinellus_Dotterel (song)", "Calidris alpina_Dunlin (call)", "Calidris alpina_Dunlin (song)", "Prunella modularis_Dunnock (call)", "Prunella modularis_Dunnock (song)", "Phylloscopus fuscatus_Dusky Warbler (call)", "Phylloscopus fuscatus_Dusky Warbler (song)", "Alopochen aegyptiaca_Egyptian Goose (call)", "Somateria mollissima_Eider (call)", "Bubo bubo_Eurasian Eagle-Owl (call)", "Bubo bubo_Eurasian Eagle-Owl (song)", "Turdus pilaris_Fieldfare (call)", "Turdus pilaris_Fieldfare (song)", "Regulus ignicapilla_Firecrest (call)", "Regulus ignicapilla_Firecrest (song)", "Fulmarus glacialis_Fulmar (call)", "Mareca strepera_Gadwall (call)", "Morus bassanus_Gannet (call)", "Sylvia borin_Garden Warbler (call)", "Sylvia borin_Garden Warbler (song)", "Spatula querquedula_Garganey (call)", "Larus hyperboreus_Glaucous Gull (call)", "Plegadis falcinellus_Glossy Ibis (call)", "Regulus regulus_Goldcrest (call)", "Regulus regulus_Goldcrest (song)", "Aquila chrysaetos_Golden Eagle (call)", "Oriolus oriolus_Golden Oriole (call)", "Oriolus oriolus_Golden Oriole (song)", "Pluvialis apricaria_Golden Plover (call)", "Pluvialis apricaria_Golden Plover (song)", "Bucephala clangula_Goldeneye (call)", "Bucephala clangula_Goldeneye (song)", "Carduelis carduelis_Goldfinch (call)", "Carduelis carduelis_Goldfinch (song)", "Mergus merganser_Goosander (call)", "Accipiter gentilis_Goshawk (call)", "Accipiter gentilis_Goshawk (song)", "Locustella naevia_Grasshopper Warbler (call)", "Locustella naevia_Grasshopper Warbler (song)", "Larus marinus_Great Black-backed Gull (call)", "Podiceps cristatus_Great Crested Grebe (call)", "Podiceps cristatus_Great Crested Grebe (song)", "Lanius excubitor_Great Grey Shrike (call)", "Lanius excubitor_Great Grey Shrike (song)", "Gavia immer_Great Northern Diver (call)", "Gavia immer_Great Northern Diver (song)", "Stercorarius skua_Great Skua (call)", "Dendrocopos major_Great Spotted Woodpecker (call)", "Parus major_Great Tit (call)", "Parus major_Great Tit (song)", "Ardea alba_Great White Egret (call)", "Anas carolinensis_Green-winged Teal (call)", "Tringa ochropus_Green Sandpiper (call)", "Tringa ochropus_Green Sandpiper (song)", "Picus viridis_Green Woodpecker (call)", "Picus viridis_Green Woodpecker (song)", "Chloris chloris_Greenfinch (call)", "Chloris chloris_Greenfinch (song)", "Phylloscopus trochiloides_Greenish Warbler (call)", "Phylloscopus trochiloides_Greenish Warbler (song)", "Tringa nebularia_Greenshank (call)", "Tringa nebularia_Greenshank (song)", "Ardea cinerea_Grey Heron (call)", "Perdix perdix_Grey Partridge (call)", "Perdix perdix_Grey Partridge (song)", "Phalaropus fulicarius_Grey Phalarope (call)", "Pluvialis squatarola_Grey Plover (call)", "Motacilla cinerea_Grey Wagtail (call)", "Motacilla cinerea_Grey Wagtail (song)", "Anser anser_Greylag Goose (call)", "Uria aalge_Guillemot (call)", "Gelochelidon nilotica_Gull-billed Tern (call)", "Coccothraustes coccothraustes_Hawfinch (call)", "Coccothraustes coccothraustes_Hawfinch (song)", "Larus argentatus_Herring Gull (call)", "Falco subbuteo_Hobby (call)", "Pernis apivorus_Honey-buzzard (call)", "Upupa epops_Hoopoe (call)", "Upupa epops_Hoopoe (song)", "Delichon urbicum_House Martin (call)", "Delichon urbicum_House Martin (song)", "Passer domesticus_House Sparrow (call)", "Passer domesticus_House Sparrow (song)", "Human_Human", "Phylloscopus ibericus_Iberian Chiffchaff (call)", "Phylloscopus ibericus_Iberian Chiffchaff (song)", "Hippolais icterina_Icterine Warbler (call)", "Hippolais icterina_Icterine Warbler (song)", "Lymnocryptes minimus_Jack Snipe (call)", "Lymnocryptes minimus_Jack Snipe (song)", "Coloeus monedula_Jackdaw (call)", "Garrulus glandarius_Jay (call)", "Garrulus glandarius_Jay (song)", "Charadrius alexandrinus_Kentish Plover (call)", "Charadrius alexandrinus_Kentish Plover (song)", "Falco tinnunculus_Kestrel (call)", "Alcedo atthis_Kingfisher (call)", "Rissa tridactyla_Kittiwake (call)", "Calidris canutus_Knot (call)", "Calcarius lapponicus_Lapland Bunting (call)", "Calcarius lapponicus_Lapland Bunting (song)", "Vanellus vanellus_Lapwing (call)", "Vanellus vanellus_Lapwing (song)", "Larus fuscus_Lesser Black-backed Gull (call)", "Acanthis cabaret_Lesser Redpoll (call)", "Acanthis cabaret_Lesser Redpoll (song)", "Dryobates minor_Lesser Spotted Woodpecker (call)", "Dryobates minor_Lesser Spotted Woodpecker (song)", "Sylvia curruca_Lesser Whitethroat (call)", "Sylvia curruca_Lesser Whitethroat (song)", "Linaria cannabina_Linnet (call)", "Linaria cannabina_Linnet (song)", "Ixobrychus minutus_Little Bittern (call)", "Ixobrychus minutus_Little Bittern (song)", "Emberiza pusilla_Little Bunting (call)", "Emberiza pusilla_Little Bunting (song)", "Egretta garzetta_Little Egret (call)", "Tachybaptus ruficollis_Little Grebe (call)", "Tachybaptus ruficollis_Little Grebe (song)", "Hydrocoloeus minutus_Little Gull (call)", "Athene noctua_Little Owl (call)", "Athene noctua_Little Owl (song)", "Charadrius dubius_Little Ringed Plover (call)", "Charadrius dubius_Little Ringed Plover (song)", "Calidris minuta_Little Stint (call)", "Sternula albifrons_Little Tern (call)", "Asio otus_Long-eared Owl (call)", "Asio otus_Long-eared Owl (song)", "Clangula hyemalis_Long-tailed Duck (call)", "Clangula hyemalis_Long-tailed Duck (song)", "Stercorarius longicaudus_Long-tailed Skua (call)", "Aegithalos caudatus_Long-tailed Tit (call)", "Pica pica_Magpie (call)", "Pica pica_Magpie (song)", "Anas platyrhynchos_Mallard (call)", "Anas platyrhynchos_Mallard (song)", "Aix galericulata_Mandarin Duck (call)", "Puffinus puffinus_Manx Shearwater (call)", "Circus aeruginosus_Marsh Harrier (call)", "Circus aeruginosus_Marsh Harrier (song)", "Poecile palustris_Marsh Tit (call)", "Poecile palustris_Marsh Tit (song)", "Anthus pratensis_Meadow Pipit (call)", "Anthus pratensis_Meadow Pipit (song)", "Ichthyaetus melanocephalus_Mediterranean Gull (call)", "Hippolais polyglotta_Melodious Warbler (call)", "Hippolais polyglotta_Melodious Warbler (song)", "Falco columbarius_Merlin (call)", "Turdus viscivorus_Mistle Thrush (call)", "Turdus viscivorus_Mistle Thrush (song)", "Circus pygargus_Montagu’s Harrier (call)", "Gallinula chloropus_Moorhen (call)", "Cygnus olor_Mute Swan (call)", "Nycticorax nycticorax_Night Heron (call)", "Luscinia megarhynchos_Nightingale (call)", "Luscinia megarhynchos_Nightingale (song)", "Caprimulgus europaeus_Nightjar (call)", "Caprimulgus europaeus_Nightjar (song)", "Sitta europaea_Nuthatch (call)", "Sitta europaea_Nuthatch (song)", "Anthus hodgsoni_Olive-backed Pipit (call)", "Anthus hodgsoni_Olive-backed Pipit (song)", "Emberiza hortulana_Ortolan Bunting (call)", "Emberiza hortulana_Ortolan Bunting (song)", "Pandion haliaetus_Osprey (call)", "Pandion haliaetus_Osprey (song)", "Haematopus ostralegus_Oystercatcher (call)", "Haematopus ostralegus_Oystercatcher (song)", "Syrrhaptes paradoxus_Pallas’s Sandgrouse (call)", "Phylloscopus proregulus_Pallas’s Warbler (call)", "Phylloscopus proregulus_Pallas’s Warbler (song)", "Loxia pytyopsittacus_Parrot Crossbill (call)", "Calidris melanotos_Pectoral Sandpiper (call)", "Calidris melanotos_Pectoral Sandpiper (song)", "Remiz pendulinus_Penduline Tit (call)", "Falco peregrinus_Peregrine (call)", "Phasianus colchicus_Pheasant (call)", "Phasianus colchicus_Pheasant (song)", "Ficedula hypoleuca_Pied Flycatcher (call)", "Ficedula hypoleuca_Pied Flycatcher (song)", "Motacilla alba_Pied Wagtail (call)", "Motacilla alba_Pied Wagtail (song)", "Anser brachyrhynchus_Pink-footed Goose (call)", "Anas acuta_Pintail (call)", "Aythya ferina_Pochard (call)", "Lagopus muta_Ptarmigan (call)", "Ardea purpurea_Purple Heron (call)", "Calidris maritima_Purple Sandpiper (call)", "Coturnix coturnix_Quail (call)", "Coturnix coturnix_Quail (song)", "Phylloscopus schwarzi_Radde’s Warbler (call)", "Phylloscopus schwarzi_Radde’s Warbler (song)", "Corvus corax_Raven (call)", "Corvus corax_Raven (song)", "Alca torda_Razorbill (call)", "Lanius collurio_Red-backed Shrike (call)", "Lanius collurio_Red-backed Shrike (song)", "Ficedula parva_Red-breasted Flycatcher (call)", "Ficedula parva_Red-breasted Flycatcher (song)", "Mergus serrator_Red-breasted Merganser (call)", "Netta rufina_Red-crested Pochard (call)", "Tarsiger cyanurus_Red-flanked Bluetail (call)", "Tarsiger cyanurus_Red-flanked Bluetail (song)", "Alectoris rufa_Red-legged Partridge (call)", "Alectoris rufa_Red-legged Partridge (song)", "Podiceps grisegena_Red-necked Grebe (call)", "Podiceps grisegena_Red-necked Grebe (song)", "Caprimulgus ruficollis_Red-necked Nightjar (song)", "Phalaropus lobatus_Red-necked Phalarope (call)", "Cecropis daurica_Red-rumped Swallow (call)", "Cecropis daurica_Red-rumped Swallow (song)", "Gavia stellata_Red-throated Diver (call)", "Lagopus lagopus_Red Grouse (call)", "Lagopus lagopus_Red Grouse (song)", "Milvus milvus_Red Kite (call)", "Tringa totanus_Redshank (call)", "Tringa totanus_Redshank (song)", "Phoenicurus phoenicurus_Redstart (call)", "Phoenicurus phoenicurus_Redstart (song)", "Turdus iliacus_Redwing (call)", "Turdus iliacus_Redwing (song)", "Emberiza schoeniclus_Reed Bunting (call)", "Emberiza schoeniclus_Reed Bunting (song)", "Acrocephalus scirpaceus_Reed Warbler (call)", "Acrocephalus scirpaceus_Reed Warbler (song)", "Anthus richardi_Richard’s Pipit (call)", "Anthus richardi_Richard’s Pipit (song)", "Larus delawarensis_Ring-billed Gull (call)", "Psittacula krameri_Ring-necked Parakeet (call)", "Turdus torquatus_Ring Ouzel (call)", "Turdus torquatus_Ring Ouzel (song)", "Charadrius hiaticula_Ringed Plover (call)", "Charadrius hiaticula_Ringed Plover (song)", "Erithacus rubecula_Robin (call)", "Erithacus rubecula_Robin (flight call)", "Erithacus rubecula_Robin (song)", "Columba livia_Rock Dove (call)", "Columba livia_Rock Dove (song)", "Anthus petrosus_Rock Pipit (call)", "Corvus frugilegus_Rook (call)", "Pastor roseus_Rose-coloured Starling (call)", "Pastor roseus_Rose-coloured Starling (song)", "Sterna dougallii_Roseate Tern (call)", "Buteo lagopus_Rough-legged Buzzard (call)", "Tadorna ferruginea_Ruddy Shelduck (call)", "Calidris pugnax_Ruff (call)", "Xema sabini_Sabine’s Gull (call)", "Riparia riparia_Sand Martin (call)", "Calidris alba_Sanderling (call)", "Thalasseus sandvicensis_Sandwich Tern (call)", "Locustella luscinioides_Savi’s Warbler (call)", "Locustella luscinioides_Savi’s Warbler (song)", "Loxia scotica_Scottish Crossbill (call)", "Acrocephalus schoenobaenus_Sedge Warbler (call)", "Acrocephalus schoenobaenus_Sedge Warbler (song)", "Calidris pusilla_Semipalmated Sandpiper (call)", "Calidris pusilla_Semipalmated Sandpiper (song)", "Serinus serinus_Serin (call)", "Serinus serinus_Serin (song)", "Tadorna tadorna_Shelduck (call)", "Eremophila alpestris_Shore Lark (call)", "Eremophila alpestris_Shore Lark (song)", "Asio flammeus_Short-eared Owl (call)", "Calandrella brachydactyla_Short-toed Lark (call)", "Calandrella brachydactyla_Short-toed Lark (song)", "Spatula clypeata_Shoveler (call)", "Spinus spinus_Siskin (call)", "Spinus spinus_Siskin (song)", "Alauda arvensis_Skylark (call)", "Alauda arvensis_Skylark (song)", "Podiceps auritus_Slavonian Grebe (call)", "Podiceps auritus_Slavonian Grebe (song)", "Gallinago gallinago_Snipe (call)", "Gallinago gallinago_Snipe (song)", "Plectrophenax nivalis_Snow Bunting (call)", "Plectrophenax nivalis_Snow Bunting (song)", "Anser caerulescens_Snow Goose (call)", "Turdus philomelos_Song Thrush (call)", "Turdus philomelos_Song Thrush (song)", "Accipiter nisus_Sparrowhawk (call)", "Platalea leucorodia_Spoonbill (call)", "Porzana porzana_Spotted Crake (call)", "Porzana porzana_Spotted Crake (song)", "Muscicapa striata_Spotted Flycatcher (call)", "Muscicapa striata_Spotted Flycatcher (song)", "Tringa erythropus_Spotted Redshank (call)", "Tringa erythropus_Spotted Redshank (song)", "Actitis macularius_Spotted Sandpiper (call)", "Sturnus vulgaris_Starling (call)", "Sturnus vulgaris_Starling (song)", "Columba oenas_Stock Dove (song)", "Burhinus oedicnemus_Stone-curlew (call)", "Burhinus oedicnemus_Stone-curlew (song)", "Saxicola rubicola_Stonechat (call)", "Saxicola rubicola_Stonechat (song)", "Hydrobates pelagicus_Storm Petrel (call)", "Hydrobates pelagicus_Storm Petrel (song)", "Sylvia cantillans_Subalpine Warbler (call)", "Sylvia cantillans_Subalpine Warbler (song)", "Hirundo rustica_Swallow (call)", "Hirundo rustica_Swallow (song)", "Apus apus_Swift (call)", "Apus apus_Swift (song)", "Anser fabalis_Taiga Bean Goose (call)", "Strix aluco_Tawny Owl (call)", "Strix aluco_Tawny Owl (song)", "Anas crecca_Teal (call)", "Anas crecca_Teal (song)", "Calidris temminckii_Temminck’s Stint (call)", "Anthus trivialis_Tree Pipit (call)", "Anthus trivialis_Tree Pipit (song)", "Passer montanus_Tree Sparrow (call)", "Passer montanus_Tree Sparrow (song)", "Certhia familiaris_Treecreeper (call)", "Certhia familiaris_Treecreeper (song)", "Aythya fuligula_Tufted Duck (call)", "Aythya fuligula_Tufted Duck (song)", "Anser serrirostris_Tundra Bean Goose (call)", "Arenaria interpres_Turnstone (call)", "Streptopelia turtur_Turtle Dove (song)", "Linaria flavirostris_Twite (call)", "Linaria flavirostris_Twite (song)", "Loxia leucoptera_Two-barred Crossbill (call)", "Loxia leucoptera_Two-barred Crossbill (song)", "Vehicle_Vehicle", "Rallus aquaticus_Water Rail (call)", "Rallus aquaticus_Water Rail (song)", "Bombycilla garrulus_Waxwing (call)", "Bombycilla garrulus_Waxwing (song)", "Oenanthe oenanthe_Wheatear (call)", "Oenanthe oenanthe_Wheatear (song)", "Numenius phaeopus_Whimbrel (call)", "Numenius phaeopus_Whimbrel (song)", "Saxicola rubetra_Whinchat (call)", "Saxicola rubetra_Whinchat (song)", "Anser albifrons_White-fronted Goose (call)", "Calidris fuscicollis_White-rumped Sandpiper (call)", "Haliaeetus albicilla_White-tailed Eagle (call)", "Haliaeetus albicilla_White-tailed Eagle (song)", "Chlidonias leucopterus_White-winged Black Tern (call)", "Ciconia ciconia_White Stork (call)", "Sylvia communis_Whitethroat (call)", "Sylvia communis_Whitethroat (song)", "Cygnus cygnus_Whooper Swan (call)", "Mareca penelope_Wigeon (call)", "Poecile montanus_Willow Tit (call)", "Phylloscopus trochilus_Willow Warbler (call)", "Phylloscopus trochilus_Willow Warbler (song)", "Tringa glareola_Wood Sandpiper (call)", "Phylloscopus sibilatrix_Wood Warbler (call)", "Phylloscopus sibilatrix_Wood Warbler (song)", "Scolopax rusticola_Woodcock (call)", "Scolopax rusticola_Woodcock (song)", "Lullula arborea_Woodlark (call)", "Lullula arborea_Woodlark (song)", "Columba palumbus_Woodpigeon (call)", "Columba palumbus_Woodpigeon (song)", "Troglodytes troglodytes_Wren (call)", "Troglodytes troglodytes_Wren (song)", "Jynx torquilla_Wryneck (call)", "Jynx torquilla_Wryneck (song)", "Phylloscopus inornatus_Yellow-browed Warbler (call)", "Phylloscopus inornatus_Yellow-browed Warbler (song)", "Larus michahellis_Yellow-legged Gull (call)", "Larus michahellis_Yellow-legged Gull (song)", "Motacilla flava_Yellow Wagtail (call)", "Motacilla flava_Yellow Wagtail (song)", "Emberiza citrinella_Yellowhammer (call)", "Emberiza citrinella_Yellowhammer (song)"]

// New - Just migrants
const migrantlist = ["Pluvialis dominica_American Golden Plover (call)", "Acanthis hornemanni_Arctic Redpoll (call)", "Sterna paradisaea_Arctic Tern (call)", "Recurvirostra avosetta_Avocet (call)", "Limosa lapponica_Bar-tailed Godwit (call)", "Tyto alba_Barn Owl (call)", "Branta leucopsis_Barnacle Goose (call)", "Cygnus columbianus_Bewick's Swan (call)", "Botaurus stellaris_Bittern (call)", "Chroicocephalus ridibundus_Black-headed Gull (call)", "Podiceps nigricollis_Black-necked Grebe (call)", "Limosa limosa_Black-tailed Godwit (call)", "Turdus merula_Blackbird (flight call)", "Sylvia atricapilla_Blackcap (call)", "Fringilla montifringilla_Brambling (call)", "Branta bernicla_Brent Goose (call)", "Branta canadensis_Canada Goose (call)", "Larus cachinnans_Caspian Gull (call)", "Phylloscopus collybita_Chiffchaff (call)", "Loxia curvirostra_Common Crossbill (call)", "Larus canus_Common Gull (call)", "Acanthis flammea_Common Redpoll (call)", "Actitis hypoleucos_Common Sandpiper (call)", "Melanitta nigra_Common Scoter (call)", "Sterna hirundo_Common Tern (call)", "Fulica atra_Coot (call)", "Crex crex_Corncrake (call)", "Cuculus canorus_Cuckoo (call)", "Calidris ferruginea_Curlew Sandpiper (call)", "Numenius arquata_Curlew (call)", "Charadrius morinellus_Dotterel (call)", "Calidris alpina_Dunlin (call)", "Prunella modularis_Dunnock (call)", "Alopochen aegyptiaca_Egyptian Goose (call)", "Somateria mollissima_Eider (call)", "Turdus pilaris_Fieldfare (call)", "Mareca strepera_Gadwall (call)", "Sylvia borin_Garden Warbler (call)", "Spatula querquedula_Garganey (call)", "Regulus regulus_Goldcrest (call)", "Pluvialis apricaria_Golden Plover (call)", "Bucephala clangula_Goldeneye (call)", "Mergus merganser_Goosander (call)", "Locustella naevia_Grasshopper Warbler (call)", "Larus marinus_Great Black-backed Gull (call)", "Podiceps cristatus_Great Crested Grebe (call)", "Tringa ochropus_Green Sandpiper (call)", "Tringa nebularia_Greenshank (call)", "Ardea cinerea_Grey Heron (call)", "Perdix perdix_Grey Partridge (call)", "Pluvialis squatarola_Grey Plover (call)", "Motacilla cinerea_Grey Wagtail (call)", "Anser anser_Greylag Goose (call)", "Delichon urbicum_House Martin (call)", "Coccothraustes coccothraustes_Hawfinch (call)", "Larus argentatus_Herring Gull (call)", "Lymnocryptes minimus_Jack Snipe (call)", "Alcedo atthis_Kingfisher (call)", "Calidris canutus_Knot (call)", "Calcarius lapponicus_Lapland Bunting (call)", "Larus fuscus_Lesser Black-backed Gull (call)", "Acanthis cabaret_Lesser Redpoll (call)", "Sylvia curruca_Lesser Whitethroat (call)", "Linaria cannabina_Linnet (call)", "Egretta garzetta_Little Egret (call)", "Tachybaptus ruficollis_Little Grebe (call)", "Hydrocoloeus minutus_Little Gull (call)", "Athene noctua_Little Owl (call)", "Charadrius dubius_Little Ringed Plover (call)", "Calidris minuta_Little Stint (call)", "Sternula albifrons_Little Tern (call)", "Asio otus_Long-eared Owl (call)", "Clangula hyemalis_Long-tailed Duck (call)", "Anas platyrhynchos_Mallard (call)", "Aix galericulata_Mandarin Duck (call)", "Anthus pratensis_Meadow Pipit (call)", "Ichthyaetus melanocephalus_Mediterranean Gull (call)", "Turdus viscivorus_Mistle Thrush (call)", "Gallinula chloropus_Moorhen (call)", "Nycticorax nycticorax_Night Heron (call)", "Luscinia megarhynchos_Nightingale (call)", "Caprimulgus europaeus_Nightjar (call)", "Anthus hodgsoni_Olive-backed Pipit (call)", "Emberiza hortulana_Ortolan Bunting (call)", "Haematopus ostralegus_Oystercatcher (call)", "Ficedula hypoleuca_Pied Flycatcher (call)", "Motacilla alba_Pied Wagtail (call)", "Anser brachyrhynchus_Pink-footed Goose (call)", "Anas acuta_Pintail (call)", "Aythya ferina_Pochard (call)", "Calidris maritima_Purple Sandpiper (call)", "Coturnix coturnix_Quail (call)", "Mergus serrator_Red-breasted Merganser (call)", "Netta rufina_Red-crested Pochard (call)", "Alectoris rufa_Red-legged Partridge (call)", "Tringa totanus_Redshank (call)", "Phoenicurus phoenicurus_Redstart (call)", "Turdus iliacus_Redwing (call)", "Emberiza schoeniclus_Reed Bunting (call)", "Acrocephalus scirpaceus_Reed Warbler (call)", "Turdus torquatus_Ring Ouzel (call)", "Charadrius hiaticula_Ringed Plover (call)", "Erithacus rubecula_Robin (flight call)", "Anthus petrosus_Rock Pipit (call)", "Sterna dougallii_Roseate Tern (call)", "Calidris pugnax_Ruff (call)", "Riparia riparia_Sand Martin (call)", "Calidris alba_Sanderling (call)", "Thalasseus sandvicensis_Sandwich Tern (call)", "Aythya marila_Scaup (call)", "Loxia scotica_Scottish Crossbill (call)", "Acrocephalus schoenobaenus_Sedge Warbler (call)", "Tadorna tadorna_Shelduck (call)", "Asio flammeus_Short-eared Owl (call)", "Spatula clypeata_Shoveler (call)", "Spinus spinus_Siskin (call)", "Alauda arvensis_Skylark (call)", "Gallinago gallinago_Snipe (call)", "Plectrophenax nivalis_Snow Bunting (call)", "Turdus philomelos_Song Thrush (call)", "Porzana porzana_Spotted Crake (call)", "Muscicapa striata_Spotted Flycatcher (call)", "Tringa erythropus_Spotted Redshank (call)", "Burhinus oedicnemus_Stone-curlew (call)", "Saxicola rubicola_Stonechat (call)", "Hirundo rustica_Swallow (call)", "Apus apus_Swift (call)", "Anser fabalis_Taiga Bean Goose (call)", "Strix aluco_Tawny Owl (call)", "Anas crecca_Teal (call)", "Anthus trivialis_Tree Pipit (call)", "Certhia familiaris_Treecreeper (call)", "Aythya fuligula_Tufted Duck (call)", "Anser serrirostris_Tundra Bean Goose (call)", "Arenaria interpres_Turnstone (call)", "Rallus aquaticus_Water Rail (call)", "Numenius phaeopus_Whimbrel (call)", "Anser albifrons_White-fronted Goose (call)", "Sylvia communis_Whitethroat (call)", "Cygnus cygnus_Whooper Swan (call)", "Mareca penelope_Wigeon (call)", "Phylloscopus trochilus_Willow Warbler (call)", "Tringa glareola_Wood Sandpiper (call)", "Scolopax rusticola_Woodcock (call)", "Lullula arborea_Woodlark (call)", "Larus michahellis_Yellow-legged Gull (call)", "Motacilla flava_Yellow Wagtail (call)", "Emberiza citrinella_Yellowhammer (call)"];
// Non birds
const others = ['Ambient Noise_Ambient Noise', 'Animal_Animal', 'Human_Human', 'Vehicle_Vehicle']

//const greylist = ["Phylloscopus fuscatus_Dusky Warbler", "Gallinago gallinago_Snipe", "Accipiter gentilis_Goshawk", "Asio otus_Long-eared Owl", "Bubo bubo_Eurasian Eagle-Owl", "Oriolus oriolus_Golden Oriole", "Cuculus canorus_Cuckoo"];
const greylist = []; //["Branta bernicla_Brent Goose"] //["Sylvia curruca_Lesser Whitethroat", "Asio otus_Long-eared Owl", "Botaurus stellaris_Bittern"];
const goldenlist = []; //["Turdus iliacus_Redwing", "Turdus philomelos_Song Thrush"];
let blocked_IDs = [];
let suppressed_IDs = [];
let enhanced_IDs = [];
let ready = false;

//const path = require("path");

const CONFIG = {

    sampleRate: 24000, specLength: 3, sigmoid: 1.0,

}

class Model {
    constructor(appPath, list) {
        this.model = null;
        this.labels = labels;
        this.config = CONFIG;
        this.chunkLength = this.config.sampleRate * this.config.specLength;
        this.model_loaded = false;
        this.appPath = null;
        this.frame_length = 512;
        this.frame_step = 186;
        this.prediction = null;
        this.result = [];
        this.appPath = appPath;
        this.list = list;
        this.goodTensors = {};
    }

    async loadModel() {
        if (this.model_loaded === false) {
            // Model files must be in a different folder than the js, assets files
            console.log('loading model from ', this.appPath)
            this.model = await tf.loadGraphModel(this.appPath + 'model.json',
                {weightPathPrefix: this.appPath});
            this.model_loaded = true;
            this.setList()
            this.inputShape = this.model.inputs[0].shape
        }
    }

    setList() {
        blocked_IDs = [];
        // get the indices of any items in the blacklist, greylist
        if (this.list === 'birds') {
            // find the position of the blocked items in the label list
            others.forEach(notBird => blocked_IDs.push(labels.indexOf(notBird)))
        } else if (this.list === 'migrants') {
            labels.forEach(species => {
                if (migrantlist.indexOf(species) === -1) blocked_IDs.push(labels.indexOf(species))
            })
        }
        greylist.forEach(species => suppressed_IDs.push(labels.indexOf(species)))
        goldenlist.forEach(species => enhanced_IDs.push(labels.indexOf(species)))
    }

    _normalize_and_fix_shape(spec) {
        spec = tf.slice2d(spec, [0, 0], [256, 384]);
        // Normalize to 0-255
        const spec_max = tf.max(spec);
        spec = spec.mul(255);
        spec = spec.div(spec_max);

        return spec;
    }

    SNRok(spectrogram, threshold) {
        //threshold = tf.scalar(threshold);
        // check signal noise threshold
        const max = tf.max(spectrogram, 1);
        //const max_tmp = max.dataSync();
        const mean = tf.mean(spectrogram, 1);
        //const mean_tmp = mean.dataSync();
        const ratio = tf.divNoNan(max, mean);
        //const ratio_tmp = ratio.dataSync();
        const snr = tf.max(ratio);
        //const snr_tmp = snr.dataSync();
        const ok = snr.greater(threshold);
        //const ok_tmp = ok.dataSync()
        return ok //.dataSync();
    }

    makeSpectrogram(audioBuffer) {
        // const s0 = performance.now();
        /*
        Would batch here but in tfjs audioBuffer has to be a 1D tensor
        */
        let spectrogram = tf.signal.stft(audioBuffer, this.frame_length, this.frame_step,);
        // Cast from complex to float
        spectrogram = tf.cast(spectrogram, 'float32');

        // Swap axes to fit output shape
        spectrogram = tf.transpose(spectrogram);
        spectrogram = tf.reverse(spectrogram, [0]);
        spectrogram = tf.abs(spectrogram);
        // Fix Spectrogram shape
        spectrogram = this._normalize_and_fix_shape(spectrogram);
        // Add channel axis
        let spec_image_resized = tf.expandDims(spectrogram, -1);

        // For small images ONLY!
        //spec_image_resized = tf.image.resizeBilinear(spec_image_resized, [128,192]);

        return spec_image_resized
    }

    warmUp(batchSize) {
        this.batchSize = parseInt(batchSize);
        const warmupResult = this.model.predict(
            tf.zeros([this.batchSize, this.inputShape[1], this.inputShape[2], this.inputShape[3]])
        );
        warmupResult.dataSync();
        warmupResult.dispose();
        ready = true;
        return true;
    }

    predictBatch(file, fileStart) {
        let batched_results = [];
        let result;
        let audacity;
        //let t0 = performance.now();
        this.batch = tf.stack(Object.values(this.goodTensors))
        //         console.log(`stacking took ${performance.now() - t0} milliseconds`)
        // t0 = performance.now();
        if (this.batch.shape[0] < this.batchSize) {
            console.log(`Adding ${this.batchSize - this.batch.shape[0]} tensors to the batch`)
            const padding = tf.zeros([this.batchSize - this.batch.shape[0], this.inputShape[1], this.inputShape[2], this.inputShape[3]]);
            this.batch = tf.concat([this.batch, padding], 0)
        }
        // console.log(`padding took ${performance.now() - t0} milliseconds`)
        //t0 = performance.now();
        const prediction = this.model.predict(this.batch, {batchSize: this.batchSize})
        //console.log(`model predict took ${performance.now() - t0} milliseconds`)
        // Get label
        let top3, top3scores;
        //t0 = performance.now();
        const {indices, values} = prediction.topk(3);
        //console.log(`topk took ${performance.now() - t0} milliseconds`)
        //t0 = performance.now();
        top3 = indices.arraySync();
        top3scores = values.arraySync();
        //console.log(`sync took ${performance.now() - t0} milliseconds`)
        //t0 = performance.now();
        const batch = {};
        const keys = Object.keys(this.goodTensors);
        for (let i = 0; i < keys.length; i++) {
            batch[keys[i]] = ({index: top3[i], score: top3scores[i], end: parseInt(keys[i]) + this.chunkLength});
        }

        // Try this method of adjusting results
        for (let [key, item] of Object.entries(batch)) {
            // turn the key back to a number and convert from samples to seconds:
            key = parseFloat(key) / this.config.sampleRate;
            const end = item.end / this.config.sampleRate;
            for (let i = 0; i < item.index.length; i++) {
                if (suppressed_IDs.includes(item.index[i])) {
                    item.score[i] = item.score[i] ** 3;
                } else if (enhanced_IDs.includes(item.index[i])) {
                    //item.score[i] = Math.pow(item.score[i], 0.35);
                    item.score[i] = Math.pow(item.score[i], 0.5);
                }
            }
            let suppressed = false;
            // If using the whitelist, we want to promote allowed IDs above any blocked IDs, so they will be visible
            // if they meet the confidence threshold.
            let temp_item = structuredClone(item);
            item.index.every(id => {
                // If and while the top result is blocked, move it to the back
                if (blocked_IDs.indexOf(id) !== -1) {
                    temp_item.index.push(temp_item.index.shift());
                    // Squash the score
                    temp_item.score.shift();
                    temp_item.score.push(-1.0);
                    return true
                }
                return false
            })
            item = structuredClone(temp_item);


            result = ({
                file: file,
                start: key,
                end: end,
                timestamp: key * 1000 + fileStart,
                position: key,
                id_1: item.index[0],
                id_2: item.index[1],
                id_3: item.index[2],
                sname: this.labels[item.index[0]].split('_')[0],
                cname: this.labels[item.index[0]].split('_')[1],
                score: Math.round(item.score[0] * 1000) / 1000,
                sname2: this.labels[item.index[1]].split('_')[0],
                cname2: this.labels[item.index[1]].split('_')[1],
                score2: Math.round(item.score[1] * 1000) / 1000,
                sname3: this.labels[item.index[2]].split('_')[0],
                cname3: this.labels[item.index[2]].split('_')[1],
                score3: Math.round(item.score[2] * 1000) / 1000,
                suppressed: suppressed
            });
            audacity = ({
                timestamp: key + '\t' + end,
                cname: this.labels[item.index[0]].split('_')[1],
                score: Math.round(item.score[0] * 1000) / 1000,
            })
            //prepare summary
            let hour = Math.floor(key / 3600), minute = Math.floor(key % 3600 / 60),
                second = Math.floor(key % 3600 % 60)
            console.log(file, `${hour}:${minute}:${second}`, item.index[0], this.labels[item.index[0]], Math.round(item.score[0] * 1000) / 1000, item.index[1], this.labels[item.index[1]], Math.round(item.score[1] * 1000) / 1000, item.index[2], this.labels[item.index[2]], Math.round(item.score[2] * 1000) / 1000);
            batched_results.push([key, result, audacity]);
        }
        this.result = this.result.concat(batched_results);
        // console.log(`format results took ${performance.now() - t0} milliseconds`)
        //t0 = performance.now();
        this.clearTensorArray();
        //console.log(`Clear tensors took ${performance.now() - t0} milliseconds`)
        return true
    }

    predictChunk(chunks, fileStart, file, finalchunk) {
        return tf.tidy(() => {
            let readyToSend = false;
            for (const [key, value] of Object.entries(chunks)) {
                let chunk = tf.tensor1d(value);
                // if the chunk is too short, pad with zeroes.
                // Min length is 0.5s, set in UI.js - a wavesurfer region option
                if (chunk.shape[0] < this.chunkLength) {
                    let padding = tf.zeros([this.chunkLength - chunk.shape[0]]);
                    chunk = chunk.concat(padding);
                }
                const spectrogram = this.makeSpectrogram(chunk);
                const useSNR = false;
                if (useSNR) {
                    const ok = this.SNRok(spectrogram, 7).dataSync();
                    if (ok > 0) {
                        this.goodTensors[key] = tf.keep(spectrogram);
                    }
                } else {
                    this.goodTensors[key] = tf.keep(spectrogram);
                }

                //Loop will continue
                if (Object.keys(this.goodTensors).length === this.batchSize) {
                    // There's a new batch of predictions to make
                    readyToSend = this.predictBatch(file, fileStart)
                }
            }
            if (finalchunk) {
                // Top up results with any final tensor predictions
                if (Object.keys(this.goodTensors).length) {
                    return this.predictBatch(file, fileStart)
                }
                return true
            } else {
                return readyToSend
            }
        })
    }

    clearTensorArray() {
        // Dispose of accumulated kept tensors in model tensor array
        for (const tensor of Object.values(this.goodTensors)) {
            tensor.dispose()
        }
        // Clear tensorArray
        this.goodTensors = {};
    }
}

//module.exports = Model;
let myModel;
onmessage = async (e) => {
        try {
            await runPredictions(e);
        }
            // If worker was respawned
        catch (e) {
            console.log(e)
        }
}

async function runPredictions(e) {
    const modelRequest = e.data.message || e.data[0];
    if (modelRequest === 'load') {
        const appPath = e.data[1];
        const list = e.data[2];
        const batch = e.data[3];
        const warmup = e.data[4]
        labels = appPath.indexOf('test') !== -1 ? new_labels : old_labels;
        postMessage({message: 'labels', labels: labels})
        console.log(`model received load instruction. Using list: ${list}, batch size ${batch}, warmup: ${warmup}`)
        myModel = new Model(appPath, list);
        await myModel.loadModel();
        if (warmup) myModel.warmUp(batch);
        postMessage({
            message: 'model-ready',
            sampleRate: myModel.config.sampleRate,
            chunkLength: myModel.chunkLength,
            backend: tf.getBackend(),
            labels: labels
        });
    } else if (modelRequest === 'predict') {
        if (!ready) {
            console.log ("ain't ready")
            return
        }
        const file = e.data.file;
        const finalChunk = e.data.finalChunk;
        if (finalChunk) console.log('Received final chunks')
        //const t0 = performance.now();
        let chunks = e.data.chunks;
        const fileStart = e.data.fileStart;
        const readyToSend = myModel.predictChunk(chunks, fileStart, file, finalChunk);
        if (readyToSend) {
            const response = {
                message: 'prediction',
                result: myModel.result,
                finished: finalChunk,
                fileStart: fileStart,
                resetResults: e.data.resetResults,
                predictionsReceived: e.data.predictionsRequested
            }
            postMessage(response);
            // reset the results
            myModel.result = [];
            //let t1 = performance.now();
            //console.log(`receive to post took: ${t1 - t0} milliseconds`)
        }
    } else if (modelRequest === 'get-spectrogram') {
        const buffer = e.data.buffer;
        // Only consider full specs
        if (buffer.length < 72000) return
        const file = e.data.file;
        const filepath = e.data.filepath;
        let image;
        tf.tidy(() => {
            const bufferTensor = tf.tensor1d(buffer);
            image = myModel.makeSpectrogram(bufferTensor).dataSync()
        })

        let response = {
            message: 'spectrogram',
            width: myModel.inputShape[2],
            height: myModel.inputShape[1],
            channels: myModel.inputShape[3],
            image: image,
            file: file,
            filepath: filepath
        }
        postMessage(response)
    } else if (modelRequest === 'list') {
        myModel.list = e.data.list;
        console.log(`Setting list to ${myModel.list}`);
        myModel.setList();
    }
}

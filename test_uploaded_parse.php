<?php
$dataKasar = file_get_contents('p/data kasar.txt');
$blocks = preg_split('/\n\s*\n/', str_replace("\r\n", "\n", $dataKasar));
foreach ($blocks as $idx => $block) {
    $lines = array_filter(array_map('trim', explode("\n", $block)));
    $uploadedVal = '';
    $found = false;
    foreach ($lines as $l) {
        if ($found) {
            $uploadedVal = $l;
            break;
        }
        if (strcasecmp($l, 'Uploaded:') === 0) {
            $found = true;
        }
    }
    $extracted = '';
    if (preg_match('/\(([^)]+)\)/', $uploadedVal, $m)) {
        $extracted = $m[1];
    } else {
        $extracted = $uploadedVal;
    }
    echo "Block $idx -> Raw: '$uploadedVal' | Extracted: '$extracted'\n";
}

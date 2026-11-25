<?php
$dataKasar = file_get_contents('p/data kasar.txt');
$pos = strpos($dataKasar, '#690971');
if ($pos !== false) {
    echo "Found at position $pos:\n";
    echo substr($dataKasar, max(0, $pos - 200), 500);
} else {
    echo "Not found with #\n";
}

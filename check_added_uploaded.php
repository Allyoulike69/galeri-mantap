<?php
$data = json_decode(preg_replace('/^\xEF\xBB\xBF/', '', file_get_contents('p/daftar-comic2.json')), true);
$pages = $data['pages'];
$last36 = array_slice($pages, -36);
foreach ($last36 as $item) {
    echo "Code: {$item['code']} | Uploaded: {$item['Uploaded']}\n";
}

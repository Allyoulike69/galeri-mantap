<?php
$files = glob('p/daftar-comic.json.*.bak');
foreach ($files as $f) {
    $content = preg_replace('/^\xEF\xBB\xBF/', '', file_get_contents($f));
    $data = json_decode($content, true);
    $count = isset($data['pages']) ? count($data['pages']) : 'unknown';
    echo "$f -> items: $count\n";
}
$filesId = glob('p/id-comic.json.*.bak');
foreach ($filesId as $f) {
    $content = preg_replace('/^\xEF\xBB\xBF/', '', file_get_contents($f));
    $data = json_decode($content, true);
    $count = isset($data['raw-links']) ? count($data['raw-links']) : 'unknown';
    echo "$f -> items: $count\n";
}

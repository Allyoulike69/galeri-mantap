<?php
$files = glob('p/daftar-comic2.json.*.bak');
foreach ($files as $f) {
    $content = preg_replace('/^\xEF\xBB\xBF/', '', file_get_contents($f));
    $data = json_decode($content, true);
    $count = isset($data['pages']) ? count($data['pages']) : 'unknown';
    echo "$f -> items: $count\n";
}
$currentContent = preg_replace('/^\xEF\xBB\xBF/', '', file_get_contents('p/daftar-comic2.json'));
$currentData = json_decode($currentContent, true);
echo "p/daftar-comic2.json -> items: " . (isset($currentData['pages']) ? count($currentData['pages']) : 'unknown') . "\n";

<?php
$files = glob('p/id-comic2.json.*.bak');
foreach ($files as $f) {
    $content = preg_replace('/^\xEF\xBB\xBF/', '', file_get_contents($f));
    $data = json_decode($content, true);
    $count = isset($data['raw-links']) ? count($data['raw-links']) : 'unknown';
    echo "$f -> items: $count\n";
}
$currentContent = preg_replace('/^\xEF\xBB\xBF/', '', file_get_contents('p/id-comic2.json'));
$currentData = json_decode($currentContent, true);
echo "p/id-comic2.json -> items: " . (isset($currentData['raw-links']) ? count($currentData['raw-links']) : 'unknown') . "\n";

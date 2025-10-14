<?php
header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');

$allowed_extensions = ['png', 'jpg', 'jpeg', 'gif', 'webp'];
$files = [];

$dir = __DIR__;
if ($handle = opendir($dir)) {
    while (false !== ($entry = readdir($handle))) {
        if ($entry != "." && $entry != "..") {
            $ext = strtolower(pathinfo($entry, PATHINFO_EXTENSION));
            if (in_array($ext, $allowed_extensions)) {
                $files[] = $entry;
            }
        }
    }
    closedir($handle);
}

sort($files);
echo json_encode($files);
?>

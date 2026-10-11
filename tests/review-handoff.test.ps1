# Synthetic records only. No real homeowner data or network/database access.
$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.IO.Compression.FileSystem
$reviewScript = Join-Path $PSScriptRoot '../scripts/review-handoff.ps1'
$cases = @('valid', 'verified-contact', 'verified-email', 'verified-link', 'orphan-contact', 'missing-lot')

foreach ($case in $cases) {
    $datasets = @{}
    $datasets['plum_creek_properties.csv'] = @(1..119 | ForEach-Object {
        [pscustomobject][ordered]@{ lot_number = $_; street_address = "$_ Example St"; city = 'Example'; state = 'KS'; postal_code = '66030' }
    })
    $datasets['plum_creek_contacts.csv'] = @(1..119 | ForEach-Object {
        [pscustomobject][ordered]@{
            id = [guid]::NewGuid().ToString(); first_name = ''; last_name = ''; display_name = 'Synthetic household'; email = '';
            phone = ''; mailing_street = ''; mailing_city = ''; mailing_state = ''; mailing_postal_code = '';
            contact_notes = 'Unverified fixture'; contact_verified_at = ''
        }
    })
    $datasets['plum_creek_contact_emails.csv'] = @([pscustomobject][ordered]@{
        lot_number = 1; contact_id = $datasets['plum_creek_contacts.csv'][0].id; display_name = 'Synthetic household';
        email = 'fixture@example.com'; email_type = 'primary'; verified = 'false'; source = 'synthetic'
    })
    $datasets['plum_creek_contact_property_links_reference.csv'] = @(1..119 | ForEach-Object {
        [pscustomobject][ordered]@{
            id = [guid]::NewGuid().ToString(); lot_number = $_; contact_id = $datasets['plum_creek_contacts.csv'][$_ - 1].id;
            relationship = 'other'; started_on = ''; ended_on = ''; ownership_verified_at = ''; notes = 'Provisional fixture'
        }
    })
    $datasets['plum_creek_legacy_reference.csv'] = @(1..119 | ForEach-Object {
        [pscustomobject][ordered]@{
            lot_number = $_; legacy_full_name = ''; legacy_first = ''; legacy_spouse = ''; legacy_last = ''; legacy_non_payer = '';
            legacy_owed = ''; legacy_mailing_street = ''; legacy_mailing_city_state_zip = ''; legacy_email = ''; verification_note = 'Unverified fixture'
        }
    })
    switch ($case) {
        'verified-contact' { $datasets['plum_creek_contacts.csv'][0].contact_verified_at = '2026-10-11T00:00:00Z' }
        'verified-email' { $datasets['plum_creek_contact_emails.csv'][0].verified = 'true' }
        'verified-link' { $datasets['plum_creek_contact_property_links_reference.csv'][0].ownership_verified_at = '2026-10-11T00:00:00Z' }
        'orphan-contact' { $datasets['plum_creek_contact_emails.csv'][0].contact_id = [guid]::NewGuid().ToString() }
        'missing-lot' { $datasets['plum_creek_properties.csv'] = $datasets['plum_creek_properties.csv'][0..117] }
    }

    $archivePath = Join-Path ([IO.Path]::GetTempPath()) ("hoa-review-test-{0}.zip" -f [guid]::NewGuid())
    try {
        $stream = [IO.File]::Open($archivePath, [IO.FileMode]::CreateNew)
        $archive = [IO.Compression.ZipArchive]::new($stream, [IO.Compression.ZipArchiveMode]::Create)
        try {
            foreach ($name in $datasets.Keys) {
                $writer = [IO.StreamWriter]::new($archive.CreateEntry($name).Open())
                try { $writer.Write(($datasets[$name] | ConvertTo-Csv -NoTypeInformation) -join "`n") }
                finally { $writer.Dispose() }
            }
        }
        finally { $archive.Dispose(); $stream.Dispose() }

        $failed = $false
        try {
            $result = & $reviewScript -ArchivePath $archivePath -HomeDirectoryPath (Join-Path $archivePath 'absent.txt') | ConvertFrom-Json
        }
        catch {
            if ($_.Exception.Message -ne 'Handoff validation failed. No records were imported.') { throw }
            $failed = $true
        }
        if ($case -eq 'valid') {
            if ($failed -or -not $result.valid_for_review -or $result.ownership_verified -or $result.properties -ne 119) {
                throw 'Valid synthetic handoff did not pass the review contract.'
            }
        }
        elseif (-not $failed) { throw "Unsafe fixture was accepted: $case" }
        Write-Output "PASS: $case"
    }
    finally {
        if (Test-Path -LiteralPath $archivePath) { Remove-Item -LiteralPath $archivePath }
    }
}

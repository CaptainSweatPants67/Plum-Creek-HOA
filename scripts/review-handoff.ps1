<#
Read a handoff ZIP in memory. Print counts/check results only, never contact data.
This does not extract files, import records, invite accounts, or connect to Supabase.
Example: pwsh -File scripts/review-handoff.ps1 -ArchivePath <path-to-zip>
#>
[CmdletBinding()]
param(
    [Parameter(Mandatory = $true)]
    [string]$ArchivePath,
    [string]$HomeDirectoryPath = (Join-Path $PSScriptRoot '../Info/HOA Homes.txt')
)

$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.IO.Compression.FileSystem
$datasets = @{}
$requiredColumns = [ordered]@{
    'plum_creek_properties.csv' = 'lot_number,street_address,city,state,postal_code'
    'plum_creek_contacts.csv' = 'id,first_name,last_name,display_name,email,phone,mailing_street,mailing_city,mailing_state,mailing_postal_code,contact_notes,contact_verified_at'
    'plum_creek_contact_emails.csv' = 'lot_number,contact_id,display_name,email,email_type,verified,source'
    'plum_creek_contact_property_links_reference.csv' = 'id,lot_number,contact_id,relationship,started_on,ended_on,ownership_verified_at,notes'
    'plum_creek_legacy_reference.csv' = 'lot_number,legacy_full_name,legacy_first,legacy_spouse,legacy_last,legacy_non_payer,legacy_owed,legacy_mailing_street,legacy_mailing_city_state_zip,legacy_email,verification_note'
}
$archive = [IO.Compression.ZipFile]::OpenRead((Resolve-Path -LiteralPath $ArchivePath).Path)
try {
    foreach ($name in $requiredColumns.Keys) {
        $entries = @($archive.Entries | Where-Object FullName -eq $name)
        if ($entries.Count -ne 1) { throw "Expected exactly one entry for $name." }
        $reader = [IO.StreamReader]::new($entries[0].Open())
        try { $rows = @($reader.ReadToEnd() | ConvertFrom-Csv) }
        finally { $reader.Dispose() }
        if ($rows.Count -eq 0) { throw "No data rows in $name." }
        $columns = @($rows[0].PSObject.Properties.Name)
        if (@(Compare-Object ($requiredColumns[$name].Split(',')) $columns).Count -ne 0) {
            throw "Unexpected columns in $name. Review the changed format before import."
        }
        $datasets[$name] = $rows
    }
}
finally { $archive.Dispose() }

$properties = $datasets['plum_creek_properties.csv']
$contacts = $datasets['plum_creek_contacts.csv']
$emails = $datasets['plum_creek_contact_emails.csv']
$links = $datasets['plum_creek_contact_property_links_reference.csv']
$legacy = $datasets['plum_creek_legacy_reference.csv']
$failures = [Collections.Generic.List[string]]::new()
function Check([bool]$Condition, [string]$Message) {
    if (-not $Condition) { $failures.Add($Message) }
}
function IsUuid([string]$Value) {
    $parsed = [guid]::Empty
    return [guid]::TryParseExact($Value, 'D', [ref]$parsed) -and $parsed -ne [guid]::Empty
}
function NormalizeAddress([string]$Value) {
    return ($Value.ToLowerInvariant() -replace '\bsouth\b', 's' -replace '\bnorth\b', 'n' -replace '\bstreet\b', 'st' -replace '\bcircle\b', 'cir' -replace '[^a-z0-9]', '')
}

Check ($properties.Count -eq 119) 'Expected 119 property rows.'
Check ($contacts.Count -eq 119) 'Expected 119 historical household contacts.'
Check ($links.Count -eq 119) 'Expected 119 provisional property links.'
Check ($legacy.Count -eq 119) 'Expected 119 historical reference rows.'
Check (@($properties | Where-Object { $_.lot_number -notmatch '^([1-9]|[1-9][0-9]|1[01][0-9])$' }).Count -eq 0) 'Invalid lot numbers.'
Check (@(1..119 | Where-Object { [string]$_ -notin $properties.lot_number }).Count -eq 0) 'Missing property lots.'
Check (@($properties | Group-Object lot_number | Where-Object Count -gt 1).Count -eq 0) 'Duplicate property lots.'
Check (@($properties | Group-Object street_address,city,state,postal_code | Where-Object Count -gt 1).Count -eq 0) 'Duplicate property addresses.'
Check (@($properties | Where-Object { -not $_.street_address -or -not $_.city -or -not $_.state -or -not $_.postal_code }).Count -eq 0) 'Incomplete property addresses.'
Check (@($contacts | Where-Object { -not (IsUuid $_.id) }).Count -eq 0) 'Invalid contact UUIDs.'
Check (@($links | Where-Object { -not (IsUuid $_.id) -or -not (IsUuid $_.contact_id) }).Count -eq 0) 'Invalid link UUIDs.'
Check (@($contacts | Group-Object id | Where-Object Count -gt 1).Count -eq 0) 'Duplicate contact IDs.'
Check (@($links | Group-Object id | Where-Object Count -gt 1).Count -eq 0) 'Duplicate link IDs.'
Check (@($emails | Where-Object { $_.contact_id -notin $contacts.id }).Count -eq 0) 'Email references a missing contact.'
Check (@($emails | Where-Object { $_.lot_number -and $_.lot_number -notin $properties.lot_number }).Count -eq 0) 'Email references a missing lot.'
Check (@($links | Where-Object { $_.contact_id -notin $contacts.id -or $_.lot_number -notin $properties.lot_number }).Count -eq 0) 'Link references a missing contact or lot.'
Check (@($legacy | Where-Object { $_.lot_number -notin $properties.lot_number }).Count -eq 0) 'Historical reference has a missing lot.'
Check (@($legacy | Group-Object lot_number | Where-Object Count -gt 1).Count -eq 0) 'Duplicate historical reference lots.'
Check (@($emails | Where-Object { -not $_.email -or $_.email_type -notin @('primary', 'secondary') }).Count -eq 0) 'Invalid email import fields.'
Check (@($emails | Group-Object contact_id,email | Where-Object Count -gt 1).Count -eq 0) 'Duplicate contact/email pairs.'
Check (@($contacts | Where-Object { $_.contact_verified_at }).Count -eq 0) 'Historical contacts must remain unverified.'
Check (@($emails | Where-Object { $_.verified.Trim().ToLowerInvariant() -ne 'false' }).Count -eq 0) 'Historical emails must explicitly remain unverified.'
Check (@($links | Where-Object { $_.ownership_verified_at -or $_.relationship -ne 'other' }).Count -eq 0) 'Historical links must remain provisional with relationship other.'

$directoryCompared = $false
if (Test-Path -LiteralPath $HomeDirectoryPath) {
    $directoryCompared = $true
    $directory = @(Get-Content -LiteralPath $HomeDirectoryPath | Where-Object { $_.Trim() } | ForEach-Object { NormalizeAddress $_ })
    $source = @($properties | ForEach-Object { NormalizeAddress ('{0}, {1}, {2} {3}' -f $_.street_address, $_.city, $_.state, $_.postal_code) })
    Check ($directory.Count -eq 119 -and @(Compare-Object $source $directory).Count -eq 0) 'Public directory and property CSV differ after street abbreviation normalization.'
}

[ordered]@{
    properties = $properties.Count
    historical_contacts = $contacts.Count
    historical_emails = $emails.Count
    provisional_links = $links.Count
    historical_reference_rows = $legacy.Count
    public_directory_compared = $directoryCompared
    issues = @($failures.ToArray())
    valid_for_review = ($failures.Count -eq 0)
    ownership_verified = $false
} | ConvertTo-Json -Depth 3

if ($failures.Count -gt 0) { throw 'Handoff validation failed. No records were imported.' }

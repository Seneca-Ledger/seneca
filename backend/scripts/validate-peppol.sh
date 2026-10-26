#!/usr/bin/env bash
# Checks Peppol BIS Billing 3.0 UBL files against the official validation
# artefacts: the CEN EN 16931 UBL rules (ConnectingEurope, compiled XSLT) and
# the Peppol rules (OpenPeppol peppol-bis-invoice-3, schematron compiled here
# with SchXslt). Runs Saxon in a throwaway Java container — the backend image
# has no Java. Writes the UBL writer's scenarios when no files are given.
#
#   scripts/validate-peppol.sh [file.xml ...]
#
# Needs docker. Downloads everything once into
# ${XDG_CACHE_HOME:-~/.cache}/seneca-kosit/peppol. A fatal rule fails the run;
# warnings are printed.
set -euo pipefail

PEPPOL_RULES=v3.0.20
CEN_RULES=1.3.17
CACHE="${XDG_CACHE_HOME:-$HOME/.cache}/seneca-kosit/peppol"
JAVA="docker run --rm -v $CACHE:/c -w /c eclipse-temurin:21-jre java -cp saxon.jar net.sf.saxon.Transform"

mkdir -p "$CACHE"
fetch() { [ -f "$CACHE/$1" ] || curl -sSL -o "$CACHE/$1" "$2"; }
fetch saxon.jar https://repo1.maven.org/maven2/net/sf/saxon/Saxon-HE/10.9/Saxon-HE-10.9.jar
fetch schxslt.jar https://repo1.maven.org/maven2/name/dmaus/schxslt/schxslt/1.10.1/schxslt-1.10.1.jar
fetch "cen-ubl-$CEN_RULES.zip" "https://github.com/ConnectingEurope/eInvoicing-EN16931/releases/download/validation-$CEN_RULES/en16931-ubl-$CEN_RULES.zip"
fetch "PEPPOL-EN16931-UBL-$PEPPOL_RULES.sch" "https://raw.githubusercontent.com/OpenPEPPOL/peppol-bis-invoice-3/$PEPPOL_RULES/rules/sch/PEPPOL-EN16931-UBL.sch"
[ -d "$CACHE/schxslt" ] || unzip -o -q "$CACHE/schxslt.jar" -d "$CACHE/schxslt"
[ -d "$CACHE/cen-$CEN_RULES" ] || unzip -o -q "$CACHE/cen-ubl-$CEN_RULES.zip" -d "$CACHE/cen-$CEN_RULES"
if [ ! -f "$CACHE/peppol-ubl-$PEPPOL_RULES.xsl" ]; then
  $JAVA -s:"PEPPOL-EN16931-UBL-$PEPPOL_RULES.sch" -xsl:schxslt/xslt/2.0/pipeline-for-svrl.xsl -o:"peppol-ubl-$PEPPOL_RULES.xsl"
fi
# One line per failed assertion: flag, rule id, message.
cat > "$CACHE/report.xsl" <<'XSL'
<xsl:stylesheet version="2.0" xmlns:xsl="http://www.w3.org/1999/XSL/Transform" xmlns:svrl="http://purl.oclc.org/dsdl/svrl">
  <xsl:output method="text"/>
  <xsl:template match="/">
    <xsl:for-each select="//svrl:failed-assert">
      <xsl:value-of select="concat(@flag, ' ', @id, ' ', normalize-space(svrl:text), '&#10;')"/>
    </xsl:for-each>
  </xsl:template>
</xsl:stylesheet>
XSL

WORK="$CACHE/run"
rm -rf "$WORK" && mkdir -p "$WORK/in"
if [ "$#" -gt 0 ]; then
  cp "$@" "$WORK/in/"
else
  docker exec seneca-backend sh -c 'cd /app && rm -rf /tmp/peppol-out && PEPPOL_OUT=/tmp/peppol-out npx jest --config jest.unit.config.ts @tests/unit/modules/e-invoices/peppol-ubl-writer >/dev/null 2>&1'
  docker cp seneca-backend:/tmp/peppol-out/. "$WORK/in/"
fi

status=0
for file in "$WORK"/in/*.xml; do
  name="$(basename "$file")"
  findings=""
  for rules in "cen-$CEN_RULES/xslt/EN16931-UBL-validation.xslt" "peppol-ubl-$PEPPOL_RULES.xsl"; do
    $JAVA -s:"run/in/$name" -xsl:"$rules" -o:"run/$name.svrl" >/dev/null
    findings+="$($JAVA -s:"run/$name.svrl" -xsl:report.xsl)"$'\n'
  done
  findings="$(grep -v '^\s*$' <<<"$findings" || true)"
  if grep -q '^fatal' <<<"$findings"; then
    echo "INVALID  $name"
    status=1
  else
    echo "valid    $name"
  fi
  if [ -n "$findings" ]; then
    while IFS= read -r line; do echo "         $line"; done <<<"$findings"
  fi
done
exit "$status"

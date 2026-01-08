#!/bin/bash

for module in auth-module account-module transaction-module bancocentral-module integration-module notification-module; do
  
  # Remove relativePath existente (se tiver)
  sed -i.bak '/<relativePath>/d' $module/pom.xml
  
  # Adiciona relativePath após </version> do parent
  awk '
    /<parent>/,/<\/parent>/ {
      if (/<\/version>/) {
        print
        print "    <relativePath>../pom.xml</relativePath>"
        next
      }
    }
    {print}
  ' $module/pom.xml > $module/pom.xml.tmp
  
  mv $module/pom.xml.tmp $module/pom.xml
  rm -f $module/pom.xml.bak
  
  echo "✅ Corrigido $module/pom.xml"
done

echo "🎉 Todos os pom.xml foram corrigidos!"

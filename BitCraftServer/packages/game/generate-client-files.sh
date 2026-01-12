#!/bin/bash

cd "$(dirname "$0")"
set -euo pipefail

language="cs"
while getopts l: flag
do
    case "${flag}" in
        l) language=${OPTARG};;
        *) language="cs";;
    esac
done

if [ "$language" = "ts" ]; then
  echo "Generating typecript files"
  spacetime generate --out-dir ../../../../bitcraft-login-server/login-server/src/autogen/ --lang=ts --namespace=Bitcraft.Spacetime
else
  echo "Deleting C# files"
  rm -rf ../../../Assets/_Project/autogen/*.cs
  echo "Generating C# files"
  spacetime generate --out-dir ../../../Assets/_Project/autogen --lang=cs --namespace=BitCraft.Spacetime
fi

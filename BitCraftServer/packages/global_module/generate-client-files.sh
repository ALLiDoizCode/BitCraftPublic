#!/bin/bash

echo "Deleting C# files"
rm -rf ../../../Assets/_Project/autogen-global/*.cs
echo "Generating C# files"
spacetime generate --out-dir ../../../Assets/_Project/autogen-global --lang=cs --namespace=BitCraft.Global

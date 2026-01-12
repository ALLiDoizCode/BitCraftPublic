#!/bin/bash

read -p "Enter the spacetime server name (e.g. bitcraft-staging): " host

for i in {2..9}; do
  spacetime publish -s "$host" "bitcraft-$i" -y
done

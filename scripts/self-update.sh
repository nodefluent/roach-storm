#!/bin/sh
git pull
yarn pkg:i
roach-storm -v
#!/bin/sh
npm pack
npm i -g roach-storm-0.1.0.tgz
rm roach-storm-0.1.0.tgz
roach-storm -h
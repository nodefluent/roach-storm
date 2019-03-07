docker build --no-cache -t roach-storm:test .
docker run -it --rm -p 1919:1919 --name roach-storm-test roach-storm:test
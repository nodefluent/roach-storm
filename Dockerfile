FROM node:10.11
RUN yarn global add roach-storm
ADD bin/docker.json /opt/docker.json
ENV NODE_NO_WARNINGS 1
ENV NODE_ENV production
CMD ["roach-storm", "-p", "1919", "-l", "/opt/docker.json"]
FROM swr.cn-north-4.myhuaweicloud.com/ddn-k8s/docker.io/node:24-alpine
WORKDIR /app
COPY package*.json ./
RUN npm install --omit=dev
COPY . .
EXPOSE 3210
CMD ["npm", "start"]

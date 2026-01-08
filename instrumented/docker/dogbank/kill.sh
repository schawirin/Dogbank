#!/bin/bash
for port in 8081 8082 8083 8084 8085 8088
do
  pid=$(lsof -t -i :$port)
  if [ -n "$pid" ]; then
    echo "Matando processo $pid que está usando a porta $port"
    kill -9 $pid
  fi
done


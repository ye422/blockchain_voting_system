#!/bin/bash -u

# Copyright 2018 ConsenSys AG.
#
# Licensed under the Apache License, Version 2.0 (the "License"); you may not use this file except in compliance with
# the License. You may obtain a copy of the License at
#
# http://www.apache.org/licenses/LICENSE-2.0
#
# Unless required by applicable law or agreed to in writing, software distributed under the License is distributed on
# an "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied. See the License for the
# specific language governing permissions and limitations under the License.

NO_LOCK_REQUIRED=false

WITH_NGROK=false
for arg in "$@"; do
    case "$arg" in
        --with-ngrok)
            WITH_NGROK=true
            ;;
        *)
            echo "Unknown option: $arg"
            exit 1
            ;;
    esac
done

. ./.env
. ./.common.sh

removeDockerImage(){
  if [[ ! -z `docker ps -a | grep $1` ]]; then
    docker image rm $1
  fi
}

echo "${bold}*************************************"
echo "Quorum Dev Quickstart "
echo "*************************************${normal}"
echo "Stop and remove network..."

docker-compose down -v
docker-compose rm -sfv

if [ -f "docker-compose-deps.yml" ]; then
    echo "Stopping dependencies..."
    docker-compose -f docker-compose-deps.yml down -v
    docker-compose rm -sfv
fi
# pet shop dapp
if [[ ! -z `docker ps -a | grep quorum-dev-quickstart_pet_shop` ]]; then
  docker stop quorum-dev-quickstart_pet_shop
  docker rm quorum-dev-quickstart_pet_shop
  removeDockerImage quorum-dev-quickstart_pet_shop
fi

if grep -q 'kibana:' docker-compose.yml 2> /dev/null ; then
  docker image rm network_elasticsearch
  docker image rm network_logstash
  docker image rm network_filebeat
  docker image rm network_metricbeat
fi

rm ${LOCK_FILE}
echo "Lock file ${LOCK_FILE} removed"

if [ "${WITH_NGROK}" = true ]; then
    PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
    NGROK_HELPER="${PROJECT_ROOT}/scripts/ngrok-utils.sh"
    if [ -f "${NGROK_HELPER}" ]; then
        # shellcheck disable=SC1090
        . "${NGROK_HELPER}"
        ngrok_stop_rpc_tunnel
        ngrok_update_root_rpc_url "${NGROK_LOCAL_RPC_URL}"
    else
        echo "ngrok helper not found at ${NGROK_HELPER}"
    fi
fi

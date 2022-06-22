FROM gitpod/workspace-full

RUN sh -c "$(curl -sSfL https://release.solana.com/v1.10.6/install)"
ENV PATH="/home/gitpod/.local/share/solana/install/active_release/bin:$PATH"

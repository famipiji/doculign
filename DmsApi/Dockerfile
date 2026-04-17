# STAGE 1: Build & Publish
# Use the full SDK image to compile the code
FROM mcr.microsoft.com/dotnet/sdk:8.0 AS build
WORKDIR /src

# Copy only the project file first and restore dependencies
# This makes subsequent builds faster (layer caching)
COPY ["DmsApi.csproj", "./"]
RUN dotnet restore

# Copy everything else and build the app
COPY . .
RUN dotnet publish -c Release -o /app/publish

# STAGE 2: Runtime
# Use a much smaller image that only contains the runtime
FROM mcr.microsoft.com/dotnet/aspnet:8.0 AS final
WORKDIR /app
COPY --from=build /app/publish .

# Tell Docker how to start the app
ENTRYPOINT ["dotnet", "DmsApi.dll"]
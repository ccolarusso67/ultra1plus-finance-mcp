using System.ServiceModel;

namespace U1PFinanceSync.Services;

/// <summary>
/// SOAP interface for QuickBooks Web Connector callbacks.
/// Web Connector calls these methods in sequence during each sync session.
/// </summary>
[ServiceContract(Namespace = "http://developer.intuit.com/")]
public interface IQBWebConnectorService
{
    /// <summary>Called by QBWC to check the server version.</summary>
    [OperationContract]
    string serverVersion();

    /// <summary>Called by QBWC to verify client version compatibility.</summary>
    [OperationContract]
    string clientVersion(string strVersion);

    /// <summary>Called by QBWC to authenticate. Returns session ticket + company file path.</summary>
    [OperationContract]
    string[] authenticate(string strUserName, string strPassword);

    /// <summary>Called by QBWC to get the next qbXML request to send to QuickBooks.</summary>
    [OperationContract]
    string sendRequestXML(
        string ticket, string strHCPResponse, string strCompanyFileName,
        string qbXMLCountry, int qbXMLMajorVers, int qbXMLMinorVers);

    /// <summary>Called by QBWC with QuickBooks' response to the last request.</summary>
    [OperationContract]
    int receiveResponseXML(
        string ticket, string response, string hresult, string message);

    /// <summary>Called by QBWC when an error occurs.</summary>
    [OperationContract]
    string connectionError(string ticket, string hresult, string message);

    /// <summary>Called by QBWC when the session is complete.</summary>
    [OperationContract]
    string closeConnection(string ticket);

    /// <summary>Called by QBWC to get the last error message.</summary>
    [OperationContract]
    string getLastError(string ticket);
}
